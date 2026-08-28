import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import { executeEditorCommand, type EditorCommandId } from './editorCommands'

describe('editor commands', () => {
	let view: EditorView | undefined

	afterEach(() => view?.destroy())

	function createView(content: string, from = 0, to = content.length) {
		view?.destroy()
		view = new EditorView({
			state: EditorState.create({
				doc: content,
				selection: EditorSelection.range(from, to),
			}),
		})
		return view
	}

	function run(command: EditorCommandId) {
		executeEditorCommand(view!, command)
		return view!.state.doc.toString()
	}

	it('converts and toggles heading levels without stacking prefixes', () => {
		createView('Title')
		expect(run('heading1')).toBe('# Title')
		expect(run('heading2')).toBe('## Title')
		expect(run('heading2')).toBe('Title')
	})

	it.each<[EditorCommandId, string]>([
		['bold', '**text**'],
		['italic', '*text*'],
		['strikethrough', '~~text~~'],
		['inlineCode', '`text`'],
	])('toggles %s on and off', (command, formatted) => {
		createView('text')
		expect(run(command)).toBe(formatted)
		expect(run(command)).toBe('text')
	})

	it('preserves another inline style while toggling italic', () => {
		createView('**text**', 2, 6)
		expect(run('italic')).toBe('***text***')
		expect(run('italic')).toBe('**text**')
	})

	it('toggles multiline blockquotes without stacking markers', () => {
		createView('hello\nworld')
		expect(run('blockquote')).toBe('> hello\n> world')
		expect(run('blockquote')).toBe('hello\nworld')
	})

	it('converts between unordered and ordered lists', () => {
		createView('* one\n+ two')
		expect(run('orderedList')).toBe('1. one\n2. two')
		expect(run('unorderedList')).toBe('- one\n- two')
		expect(run('unorderedList')).toBe('one\ntwo')
	})

	it('converts a list to tasks and toggles task formatting off', () => {
		createView('- one\n- two')
		expect(run('taskList')).toBe('- [ ] one\n- [ ] two')
		expect(run('taskList')).toBe('one\ntwo')
	})

	it('converts task lists directly to other list types', () => {
		createView('- [x] done\n- [ ] next')
		expect(run('orderedList')).toBe('1. done\n2. next')
	})

	it('toggles a multiline fenced code block', () => {
		createView('line 1\nline 2')
		expect(run('codeBlock')).toBe('```\nline 1\nline 2\n```')
		expect(run('codeBlock')).toBe('line 1\nline 2')
	})

	it('does not nest an existing Markdown link', () => {
		createView('OpenAI', 0, 6)
		expect(run('link')).toBe('[OpenAI](url)')
		expect(run('link')).toBe('[OpenAI](url)')
		expect(
			view!.state.sliceDoc(view!.state.selection.main.from, view!.state.selection.main.to),
		).toBe('url')
	})

	it('keeps a cursor on the same content when transforming its line', () => {
		createView('Title', 2, 2)
		expect(run('heading3')).toBe('### Title')
		expect(view!.state.selection.main.head).toBe(6)
	})

	it('inserts sensible placeholder text for an empty selection', () => {
		createView('', 0, 0)
		expect(run('italic')).toBe('*italic text*')
		expect(
			view!.state.sliceDoc(view!.state.selection.main.from, view!.state.selection.main.to),
		).toBe('italic text')
	})
})
