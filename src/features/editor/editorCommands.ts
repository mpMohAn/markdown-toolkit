import { EditorSelection, type SelectionRange } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export type EditorCommandId =
	| 'heading1'
	| 'heading2'
	| 'heading3'
	| 'heading4'
	| 'heading5'
	| 'heading6'
	| 'bold'
	| 'italic'
	| 'strikethrough'
	| 'link'
	| 'inlineCode'
	| 'codeBlock'
	| 'blockquote'
	| 'unorderedList'
	| 'orderedList'
	| 'taskList'

export interface EditorCommandDefinition {
	id: EditorCommandId
	label: string
	title: string
	symbol: string
	group: 'structure' | 'inline' | 'block'
}

export const EDITOR_COMMANDS: EditorCommandDefinition[] = [
	...([1, 2, 3, 4, 5, 6] as const).map((level) => ({
		id: `heading${level}` as EditorCommandId,
		label: `Heading ${level}`,
		title: `Heading ${level}`,
		symbol: `H${level}`,
		group: 'structure' as const,
	})),
	{ id: 'bold', label: 'Bold', title: 'Bold (Ctrl/Cmd+B)', symbol: 'B', group: 'inline' },
	{ id: 'italic', label: 'Italic', title: 'Italic (Ctrl/Cmd+I)', symbol: 'I', group: 'inline' },
	{
		id: 'strikethrough',
		label: 'Strikethrough',
		title: 'Strikethrough',
		symbol: 'S',
		group: 'inline',
	},
	{ id: 'link', label: 'Link', title: 'Link (Ctrl/Cmd+K)', symbol: '⌁', group: 'inline' },
	{ id: 'inlineCode', label: 'Inline code', title: 'Inline code', symbol: '`', group: 'inline' },
	{ id: 'codeBlock', label: 'Code block', title: 'Code block', symbol: '{…}', group: 'block' },
	{ id: 'blockquote', label: 'Blockquote', title: 'Blockquote', symbol: '❯', group: 'block' },
	{
		id: 'unorderedList',
		label: 'Unordered list',
		title: 'Unordered list (Ctrl/Cmd+Shift+8)',
		symbol: '•',
		group: 'block',
	},
	{
		id: 'orderedList',
		label: 'Ordered list',
		title: 'Ordered list (Ctrl/Cmd+Shift+7)',
		symbol: '1.',
		group: 'block',
	},
	{ id: 'taskList', label: 'Task list', title: 'Task list', symbol: '☐', group: 'block' },
]

export function executeEditorCommand(view: EditorView, command: EditorCommandId): boolean {
	if (command.startsWith('heading')) {
		transformLines(view, { kind: 'heading', level: Number(command.at(-1)) })
	} else {
		const transformations: Record<Exclude<EditorCommandId, `heading${number}`>, () => void> = {
			bold: () => toggleWrap(view, '**', '**', 'bold text'),
			italic: () => toggleWrap(view, '*', '*', 'italic text'),
			strikethrough: () => toggleWrap(view, '~~', '~~', 'strikethrough text'),
			link: () => insertLink(view),
			inlineCode: () => toggleWrap(view, '`', '`', 'code'),
			codeBlock: () => toggleWrap(view, '```\n', '\n```', 'code'),
			blockquote: () => transformLines(view, { kind: 'blockquote' }),
			unorderedList: () => transformLines(view, { kind: 'unorderedList' }),
			orderedList: () => transformLines(view, { kind: 'orderedList' }),
			taskList: () => transformLines(view, { kind: 'taskList' }),
		}

		transformations[command as keyof typeof transformations]()
	}

	view.focus()
	return true
}

function toggleWrap(view: EditorView, prefix: string, suffix: string, placeholder: string) {
	view.dispatch(
		view.state.changeByRange((range) => {
			const selectedText = view.state.sliceDoc(range.from, range.to)

			if (selectedText && hasOwnMarkers(selectedText, prefix, suffix)) {
				const content = selectedText.slice(prefix.length, -suffix.length)
				return {
					changes: { from: range.from, to: range.to, insert: content },
					range: EditorSelection.range(range.from, range.from + content.length),
				}
			}

			if (selectedText && isSurrounded(view, range, prefix, suffix)) {
				const from = range.from - prefix.length
				return {
					changes: { from, to: range.to + suffix.length, insert: selectedText },
					range: EditorSelection.range(from, from + selectedText.length),
				}
			}

			const content = selectedText || placeholder
			const insert = `${prefix}${content}${suffix}`
			const selectionFrom = range.from + prefix.length

			return {
				changes: { from: range.from, to: range.to, insert },
				range: EditorSelection.range(selectionFrom, selectionFrom + content.length),
			}
		}),
	)
}

function hasOwnMarkers(text: string, prefix: string, suffix: string) {
	if (!text.startsWith(prefix) || !text.endsWith(suffix)) return false
	if (prefix === '*') return countEdgeCharacters(text, '*', true) % 2 === 1
	if (prefix === '`') return countEdgeCharacters(text, '`', true) === 1
	return text.length >= prefix.length + suffix.length
}

function isSurrounded(view: EditorView, range: SelectionRange, prefix: string, suffix: string) {
	if (range.from < prefix.length || range.to + suffix.length > view.state.doc.length) return false

	const before = view.state.sliceDoc(0, range.from)
	const after = view.state.sliceDoc(range.to)
	if (!before.endsWith(prefix) || !after.startsWith(suffix)) return false
	if (prefix === '*') {
		return (
			countEdgeCharacters(before, '*', false) % 2 === 1 &&
			countEdgeCharacters(after, '*', true) % 2 === 1
		)
	}
	if (prefix === '`') {
		return (
			countEdgeCharacters(before, '`', false) === 1 &&
			countEdgeCharacters(after, '`', true) === 1
		)
	}
	return true
}

function countEdgeCharacters(text: string, character: string, fromStart: boolean) {
	let count = 0
	let index = fromStart ? 0 : text.length - 1
	const step = fromStart ? 1 : -1

	while (text[index] === character) {
		count += 1
		index += step
	}

	return count
}

function insertLink(view: EditorView) {
	view.dispatch(
		view.state.changeByRange((range) => {
			const existingLink = findContainingLink(view.state.doc.toString(), range)
			if (existingLink) {
				return {
					changes: [],
					range: EditorSelection.range(existingLink.urlFrom, existingLink.urlTo),
				}
			}

			const selectedText = view.state.sliceDoc(range.from, range.to)
			const label = selectedText || 'link text'
			const insert = `[${label}](url)`
			const urlFrom = range.from + label.length + 3

			return {
				changes: { from: range.from, to: range.to, insert },
				range: EditorSelection.range(urlFrom, urlFrom + 3),
			}
		}),
	)
}

function findContainingLink(content: string, range: SelectionRange) {
	const linkPattern = /\[[^\]\n]+\]\(([^)\n]+)\)/g
	for (const match of content.matchAll(linkPattern)) {
		const from = match.index
		const to = from + match[0].length
		if (range.from >= from && range.to <= to) {
			const urlFrom = from + match[0].indexOf(match[1])
			return { urlFrom, urlTo: urlFrom + match[1].length }
		}
	}

	return null
}

type LineKind = 'plain' | 'heading' | 'blockquote' | 'unorderedList' | 'orderedList' | 'taskList'

interface LineParts {
	indent: string
	content: string
	kind: LineKind
	level?: number
	contentColumn: number
}

type LineTarget =
	| { kind: 'heading'; level: number }
	| { kind: 'blockquote' }
	| { kind: 'unorderedList' }
	| { kind: 'orderedList' }
	| { kind: 'taskList' }

interface TransformedLine {
	text: string
	contentColumn: number
}

function transformLines(view: EditorView, target: LineTarget) {
	view.dispatch(
		view.state.changeByRange((range) => {
			const startLine = view.state.doc.lineAt(range.from)
			const endPosition = range.to > range.from ? range.to - 1 : range.to
			const endLine = view.state.doc.lineAt(endPosition)
			const lines: LineParts[] = []

			for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber += 1) {
				lines.push(parseLine(view.state.doc.line(lineNumber).text))
			}

			const removeTarget = lines.every((line) => isTarget(line, target))
			const transformed = lines.map((line, index) =>
				formatLine(line, target, index, removeTarget),
			)
			const insert = transformed.map((line) => line.text).join('\n')

			return {
				changes: { from: startLine.from, to: endLine.to, insert },
				range: lineSelection(
					range,
					startLine.from,
					insert.length,
					lines[0],
					transformed[0],
				),
			}
		}),
	)
}

function parseLine(text: string): LineParts {
	const heading = /^(\s{0,3})(#{1,6})[ \t]+(.*)$/.exec(text)
	if (heading) return lineParts(heading, 'heading', heading[2].length)

	const task = /^(\s*)[-*+]\s+\[[ xX]\]\s+(.*)$/.exec(text)
	if (task) return lineParts(task, 'taskList')

	const unordered = /^(\s*)[-*+]\s+(.*)$/.exec(text)
	if (unordered) return lineParts(unordered, 'unorderedList')

	const ordered = /^(\s*)\d+[.)]\s+(.*)$/.exec(text)
	if (ordered) return lineParts(ordered, 'orderedList')

	const quote = /^(\s*)>\s?(.*)$/.exec(text)
	if (quote) return lineParts(quote, 'blockquote')

	const indent = /^\s*/.exec(text)?.[0] ?? ''
	return {
		indent,
		content: text.slice(indent.length),
		kind: 'plain',
		contentColumn: indent.length,
	}
}

function lineParts(match: RegExpExecArray, kind: LineKind, level?: number): LineParts {
	return {
		indent: match[1],
		content: match.at(-1) ?? '',
		kind,
		level,
		contentColumn: match[0].length - (match.at(-1)?.length ?? 0),
	}
}

function isTarget(line: LineParts, target: LineTarget) {
	return line.kind === target.kind && (target.kind !== 'heading' || line.level === target.level)
}

function formatLine(
	line: LineParts,
	target: LineTarget,
	index: number,
	removeTarget: boolean,
): TransformedLine {
	if (removeTarget) return withMarker(line, '')
	if (target.kind === 'heading') return withMarker(line, `${'#'.repeat(target.level)} `)
	if (target.kind === 'blockquote') return withMarker(line, '> ')
	if (target.kind === 'unorderedList') return withMarker(line, '- ')
	if (target.kind === 'orderedList') return withMarker(line, `${index + 1}. `)
	return withMarker(line, '- [ ] ')
}

function withMarker(line: LineParts, marker: string): TransformedLine {
	return {
		text: `${line.indent}${marker}${line.content}`,
		contentColumn: line.indent.length + marker.length,
	}
}

function lineSelection(
	range: SelectionRange,
	from: number,
	insertedLength: number,
	originalLine: LineParts,
	transformedLine: TransformedLine,
) {
	if (!range.empty) return EditorSelection.range(from, from + insertedLength)

	const originalColumn = range.from - from
	const contentOffset = Math.max(0, originalColumn - originalLine.contentColumn)
	const cursor =
		from + transformedLine.contentColumn + Math.min(contentOffset, originalLine.content.length)
	return EditorSelection.cursor(cursor)
}
