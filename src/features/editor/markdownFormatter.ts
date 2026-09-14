import type { EditorView } from '@codemirror/view'

const FENCE_OPEN = /^( {0,3})(`{3,}|~{3,})(.*)$/

export function formatMarkdown(source: string): string {
	if (!source) return ''

	const lines = source.replace(/\r\n?/g, '\n').split('\n')
	const formatted: string[] = []
	let fence: { marker: '`' | '~'; length: number } | null = null
	let blankCount = 0

	for (const originalLine of lines) {
		const opening: RegExpExecArray | null = !fence ? FENCE_OPEN.exec(originalLine) : null
		const closesFence = fence
			? new RegExp(`^ {0,3}${escapeRegExp(fence.marker)}{${fence.length},}[ \\t]*$`).test(
					originalLine,
				)
			: false

		let line = originalLine
		if (!fence && opening) {
			fence = { marker: opening[2][0] as '`' | '~', length: opening[2].length }
		} else if (fence) {
			if (closesFence) fence = null
		} else {
			line = formatStructuralLine(line)
		}

		if (!fence && !opening && /^\s*$/.test(line)) {
			blankCount += 1
			if (blankCount > 2) continue
			line = ''
		} else {
			blankCount = 0
		}
		formatted.push(line)
	}

	while (formatted.at(-1) === '') formatted.pop()
	return formatted.length ? `${formatted.join('\n')}\n` : ''
}

export function formatMarkdownInEditor(view: EditorView): boolean {
	const source = view.state.doc.toString()
	const formatted = formatMarkdown(source)
	if (formatted !== source) {
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: formatted },
			userEvent: 'input.format-markdown',
		})
	}
	view.focus()
	return true
}

function formatStructuralLine(source: string): string {
	const { content, suffix } = splitHardBreak(source)
	let line = content.replace(/[\t ]+$/, '')

	line = line.replace(/^( {0,3})(#{1,6})[\t ]+(.*)$/, '$1$2 $3')
	line = line.replace(
		/^(\s*)[-+*][\t ]+\[([ xX])\][\t ]+/,
		(_match, indent, checked) => `${indent}- [${checked.toLowerCase()}] `,
	)
	line = line.replace(/^(\s*)[-+*][\t ]+/, '$1- ')
	line = line.replace(/^(\s*)(\d+)[)][\t ]+/, '$1$2. ')

	return `${line}${suffix}`
}

function splitHardBreak(line: string): { content: string; suffix: string } {
	const trailingSpaces = / +$/.exec(line)?.[0].length ?? 0
	return trailingSpaces >= 2
		? { content: line.slice(0, -trailingSpaces), suffix: '  ' }
		: { content: line, suffix: '' }
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
