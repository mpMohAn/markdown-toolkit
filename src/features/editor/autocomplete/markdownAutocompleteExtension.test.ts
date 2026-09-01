import { history, undo } from '@codemirror/commands'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { afterEach, describe, expect, it } from 'vitest'
import {
	acceptMarkdownContinuation,
	dismissMarkdownContinuation,
	markdownAutocomplete,
} from './markdownAutocompleteExtension'

describe('markdownAutocomplete extension', () => {
	let view: EditorView | null = null

	afterEach(() => {
		view?.destroy()
		view = null
	})

	it('renders inaccessible ghost text without changing the document', () => {
		view = createEditor('## Heading\n')

		const ghost = view.dom.querySelector('.cm-markdown-autocomplete-ghost')
		expect(ghost?.textContent).toBe('## ')
		expect(ghost).toHaveAttribute('aria-hidden', 'true')
		expect(view.state.doc.toString()).toBe('## Heading\n')
	})

	it('accepts with one undoable transaction and moves the cursor', () => {
		view = createEditor('1. one\n')

		expect(acceptMarkdownContinuation(view)).toBe(true)
		expect(view.state.doc.toString()).toBe('1. one\n2. ')
		expect(view.state.selection.main.head).toBe(view.state.doc.length)
		expect(view.dom.querySelector('.cm-markdown-autocomplete-ghost')).not.toBeInTheDocument()

		expect(undo(view)).toBe(true)
		expect(view.state.doc.toString()).toBe('1. one\n')
	})

	it('does not handle Tab acceptance when there is no suggestion', () => {
		view = createEditor('normal paragraph\n')

		expect(acceptMarkdownContinuation(view)).toBe(false)
		expect(view.state.doc.toString()).toBe('normal paragraph\n')
	})

	it('dismisses the current suggestion with Escape behavior', () => {
		view = createEditor('- item\n')

		expect(dismissMarkdownContinuation(view)).toBe(true)
		expect(view.dom.querySelector('.cm-markdown-autocomplete-ghost')).not.toBeInTheDocument()
		expect(dismissMarkdownContinuation(view)).toBe(false)
	})

	function createEditor(content: string) {
		const parent = document.createElement('div')
		document.body.append(parent)
		const editor = new EditorView({
			parent,
			state: EditorState.create({
				doc: content,
				selection: { anchor: content.length },
				extensions: [history(), markdownAutocomplete()],
			}),
		})
		editor.focus()
		editor.dispatch({})
		return editor
	}
})
