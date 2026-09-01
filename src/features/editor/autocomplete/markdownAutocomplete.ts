export type MarkdownContinuationType =
	| 'heading'
	| 'unordered-list'
	| 'task-list'
	| 'ordered-list'
	| 'blockquote'
	| 'code-block-structural'
	| 'learned-heading'

export interface MarkdownContinuation {
	text: string
	type: MarkdownContinuationType
}

export interface MarkdownContinuationContext {
	documentText: string
	cursorOffset: number
	selectionFrom?: number
	selectionTo?: number
}

type ContinuationTarget = MarkdownContinuation

export function getMarkdownContinuation({
	documentText,
	cursorOffset,
	selectionFrom = cursorOffset,
	selectionTo = cursorOffset,
}: MarkdownContinuationContext): MarkdownContinuation | null {
	if (selectionFrom !== selectionTo || cursorOffset < 0 || cursorOffset > documentText.length) {
		return null
	}

	const lineStart = documentText.lastIndexOf('\n', Math.max(0, cursorOffset - 1)) + 1
	const nextLineBreak = documentText.indexOf('\n', cursorOffset)
	const lineEnd = nextLineBreak === -1 ? documentText.length : nextLineBreak
	const currentLine = documentText.slice(lineStart, lineEnd)

	if (cursorOffset !== lineEnd || !/^\s*$/.test(currentLine) || lineStart === 0) {
		return null
	}

	const previousLineEnd = lineStart - 1
	const previousLineStart = documentText.lastIndexOf('\n', previousLineEnd - 1) + 1
	const previousLine = documentText.slice(previousLineStart, previousLineEnd)
	const immediateMarkdownTarget = inferImmediateContinuation(previousLine)
	const documentContext = analyzeDocumentContext(
		documentText,
		lineStart,
		!immediateMarkdownTarget,
	)

	const target = documentContext.insideFence
		? inferCodeBlockStructuralContinuation(previousLine)
		: (immediateMarkdownTarget ??
			inferRepeatedHeading(documentContext, documentText, lineStart))

	if (!target) return null

	const text = target.text.startsWith(currentLine)
		? target.text.slice(currentLine.length)
		: currentLine.length === 0
			? target.text
			: null

	return text ? { text, type: target.type } : null
}

function inferImmediateContinuation(line: string): ContinuationTarget | null {
	const task = /^(\s*)[-*+]\s+\[[ xX]\]\s+(\S(?:.*\S)?)\s*$/.exec(line)
	if (task) return { text: `${task[1]}- [ ] `, type: 'task-list' }

	const ordered = /^(\s*)(\d+)([.)])\s+(\S(?:.*\S)?)\s*$/.exec(line)
	if (ordered) {
		return {
			text: `${ordered[1]}${Number(ordered[2]) + 1}${ordered[3]} `,
			type: 'ordered-list',
		}
	}

	const unordered = /^(\s*)([-*+])\s+(?!\[[ xX]\](?:\s|$))(\S(?:.*\S)?)\s*$/.exec(line)
	if (unordered) {
		return {
			text: `${unordered[1]}${unordered[2]} `,
			type: 'unordered-list',
		}
	}

	const heading = /^(\s{0,3})(#{1,6})[ \t]+(\S(?:.*\S)?)\s*$/.exec(line)
	if (heading) {
		return {
			text: `${heading[1]}${heading[2]} `,
			type: 'heading',
		}
	}

	const blockquote = /^(\s*)>\s+(\S(?:.*\S)?)\s*$/.exec(line)
	if (blockquote) {
		return {
			text: `${blockquote[1]}> `,
			type: 'blockquote',
		}
	}

	return null
}

function inferCodeBlockStructuralContinuation(line: string): ContinuationTarget | null {
	const asciiTree = /^((?:[ \t]*│[ \t]*)*[ \t]*)([|+\\])(-{2,})[ \t]+(\S(?:.*\S)?)\s*$/.exec(line)
	if (asciiTree) {
		return {
			text: `${asciiTree[1]}${asciiTree[2]}${asciiTree[3]} `,
			type: 'code-block-structural',
		}
	}

	const unicodeTree = /^((?:[ \t]*│[ \t]*)*[ \t]*├[─━]{2,})[ \t]+(\S(?:.*\S)?)\s*$/.exec(line)
	return unicodeTree ? { text: `${unicodeTree[1]} `, type: 'code-block-structural' } : null
}

interface DocumentContext {
	headings: Array<{ count: number; lastLine: number }>
	insideFence: boolean
}

function analyzeDocumentContext(
	documentText: string,
	currentLineStart: number,
	collectHeadings: boolean,
): DocumentContext {
	const lines = documentText.slice(0, currentLineStart).split('\n')
	let openFence: { character: '`' | '~'; length: number } | null = null
	const headings = Array.from({ length: 6 }, () => ({ count: 0, lastLine: -1 }))

	for (const [lineIndex, line] of lines.entries()) {
		if (!openFence) {
			const opening = /^ {0,3}(`{3,}|~{3,})/.exec(line)
			if (opening) {
				openFence = {
					character: opening[1][0] as '`' | '~',
					length: opening[1].length,
				}
				continue
			}

			const heading = collectHeadings ? /^ {0,3}(#{1,6})[ \t]+\S/.exec(line) : null
			if (heading) {
				const headingState = headings[heading[1].length - 1]
				headingState.count += 1
				headingState.lastLine = lineIndex
			}
			continue
		}

		const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line)
		if (
			closing &&
			closing[1][0] === openFence.character &&
			closing[1].length >= openFence.length
		) {
			openFence = null
		}
	}

	return { headings, insideFence: openFence !== null }
}

function inferRepeatedHeading(
	documentContext: DocumentContext,
	documentText: string,
	currentLineStart: number,
): ContinuationTarget | null {
	if (!isFreshSectionContext(documentText, currentLineStart)) return null

	let selectedLevel = 0
	let selectedLastLine = -1
	for (const [index, heading] of documentContext.headings.entries()) {
		if (heading.count >= 2 && heading.lastLine > selectedLastLine) {
			selectedLevel = index + 1
			selectedLastLine = heading.lastLine
		}
	}

	return selectedLevel ? { text: `${'#'.repeat(selectedLevel)} `, type: 'learned-heading' } : null
}

function isFreshSectionContext(documentText: string, currentLineStart: number) {
	const precedingLines = documentText.slice(0, currentLineStart).split('\n')
	let skippedBlankLines = 0

	for (let index = precedingLines.length - 2; index >= 0; index -= 1) {
		const line = precedingLines[index]
		if (!line.trim()) {
			skippedBlankLines += 1
			if (skippedBlankLines > 2) return false
			continue
		}

		if (/^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return true
		if (/^\s*(?:#{1,6}[ \t]|[-*+]\s|\d+[.)]\s|>)/.test(line)) {
			return false
		}
		if (inferCodeBlockStructuralContinuation(line)) return false
		if (/^ {0,3}(?:`{3,}|~{3,})/.test(line)) return false
		return true
	}

	return false
}
