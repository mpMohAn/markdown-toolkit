import { EditorSelection } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownEditor } from './MarkdownEditor'

describe('MarkdownEditor', () => {
	it('renders persisted content in an accessible editor', () => {
		render(<MarkdownEditor content="# Persisted" onChange={() => undefined} />)

		expect(screen.getByRole('textbox', { name: 'Markdown editor' })).toHaveTextContent(
			'# Persisted',
		)
	})

	it('toggles line numbers without changing content or selection', () => {
		let editorView: EditorView | null = null
		const onChange = vi.fn()
		const onReady = (view: EditorView | null) => {
			editorView = view
		}
		const { container, rerender } = render(
			<MarkdownEditor content={'first\nsecond'} onChange={onChange} onReady={onReady} />,
		)
		editorView!.dispatch({ selection: EditorSelection.range(2, 8) })

		expect(container.querySelector('.cm-lineNumbers')).not.toBeInTheDocument()
		const initialEditorView = editorView
		rerender(
			<MarkdownEditor
				content={'first\nsecond'}
				onChange={onChange}
				onReady={onReady}
				showLineNumbers
			/>,
		)

		expect(container.querySelector('.cm-lineNumbers')).toBeInTheDocument()
		expect(editorView!.state.doc.toString()).toBe('first\nsecond')
		expect(editorView!.state.selection.main.from).toBe(2)
		expect(editorView!.state.selection.main.to).toBe(8)
		expect(editorView).toBe(initialEditorView)
		expect(onChange).not.toHaveBeenCalled()

		rerender(
			<MarkdownEditor
				content={'first\nsecond'}
				onChange={onChange}
				onReady={onReady}
				showLineNumbers={false}
			/>,
		)
		expect(container.querySelector('.cm-lineNumbers')).not.toBeInTheDocument()
	})

	it.each<[string, boolean, string, string]>([
		['b', false, 'text', '**text**'],
		['b', false, '**text**', 'text'],
		['i', false, 'text', '*text*'],
		['k', false, 'text', '[text](url)'],
		['7', true, 'first\nsecond', '1. first\n2. second'],
		['8', true, 'first\nsecond', '- first\n- second'],
	])(
		'uses the shared command for the %s keyboard shortcut',
		(key, shiftKey, content, expected) => {
			let editorView: EditorView | null = null
			const onChange = vi.fn()
			render(
				<MarkdownEditor
					content={content}
					onChange={onChange}
					onReady={(view) => {
						editorView = view
					}}
				/>,
			)
			editorView!.dispatch({
				selection: EditorSelection.range(0, content.length),
			})

			fireEvent.keyDown(screen.getByRole('textbox', { name: 'Markdown editor' }), {
				key,
				ctrlKey: true,
				shiftKey,
			})

			expect(onChange).toHaveBeenLastCalledWith(expected)
		},
	)
})
