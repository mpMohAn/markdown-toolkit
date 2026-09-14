import { history, undo } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { formatMarkdown, formatMarkdownInEditor } from './markdownFormatter'

describe('deterministic Markdown formatter', () => {
	let view: EditorView | undefined
	afterEach(() => {
		view?.destroy()
		vi.restoreAllMocks()
	})

	it('normalizes common Markdown structure and blank-line spacing', () => {
		expect(
			formatMarkdown('##\tTitle  \r\n* one\r+ two\r\n3) three\n- [X] done\n\n\n\nEnd'),
		).toBe('## Title  \n- one\n- two\n3. three\n- [x] done\n\n\nEnd\n')
	})

	it('preserves fenced code contents except normalized document line endings', () => {
		const source = 'Before  \r\n```md\r\n*  code  \r\n#  code heading\r\n```\r\nAfter   '
		expect(formatMarkdown(source)).toBe(
			'Before  \n```md\n*  code  \n#  code heading\n```\nAfter  \n',
		)
	})

	it('does not interpret hashtags as headings and preserves hard breaks', () => {
		expect(formatMarkdown('#Topic   \nText   \n')).toBe('#Topic  \nText  \n')
	})

	it('is idempotent and handles an empty document', () => {
		const once = formatMarkdown('##   Heading\n+ item')
		expect(formatMarkdown(once)).toBe(once)
		expect(formatMarkdown('')).toBe('')
		expect(formatMarkdown('   \n\n')).toBe('')
	})

	it('applies one editor transaction, restores focus, and undoes in one step', () => {
		view = new EditorView({
			parent: document.body,
			state: EditorState.create({ doc: '* item', extensions: [history()] }),
		})
		formatMarkdownInEditor(view)
		expect(view.state.doc.toString()).toBe('- item\n')
		expect(view.hasFocus).toBe(true)
		expect(undo(view)).toBe(true)
		expect(view.state.doc.toString()).toBe('* item')
	})

	it('does not dispatch when the document is already formatted', () => {
		view = new EditorView({
			parent: document.body,
			state: EditorState.create({ doc: '# Ready\n' }),
		})
		const dispatch = vi.spyOn(view, 'dispatch')

		formatMarkdownInEditor(view)

		expect(dispatch).not.toHaveBeenCalled()
	})

	it('does not schedule asynchronous formatting work', () => {
		const timeout = vi.spyOn(globalThis, 'setTimeout')
		const frame = vi.spyOn(globalThis, 'requestAnimationFrame')

		expect(formatMarkdown('* item')).toBe('- item\n')
		expect(timeout).not.toHaveBeenCalled()
		expect(frame).not.toHaveBeenCalled()
	})

	it('formats large input synchronously in one linear pass', () => {
		const source = Array.from({ length: 20_000 }, (_, index) => `* item ${index}`).join('\r\n')
		const result = formatMarkdown(source)

		expect(result).not.toBeInstanceOf(Promise)
		expect(result.startsWith('- item 0\n')).toBe(true)
		expect(result.endsWith('- item 19999\n')).toBe(true)
	})
})
