import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EditorToolbar } from './EditorToolbar'

describe('EditorToolbar', () => {
	let view: EditorView | undefined

	afterEach(() => view?.destroy())

	it('runs formatting through the shared command layer', async () => {
		const user = userEvent.setup()
		view = new EditorView({
			state: EditorState.create({
				doc: 'selected',
				selection: EditorSelection.range(0, 8),
			}),
		})
		render(
			<EditorToolbar
				editorView={view}
				showLineNumbers={false}
				onToggleLineNumbers={() => undefined}
			/>,
		)

		await user.click(screen.getByRole('button', { name: 'Bold' }))

		expect(view.state.doc.toString()).toBe('**selected**')

		await user.click(screen.getByRole('button', { name: 'Bold' }))
		expect(view.state.doc.toString()).toBe('selected')
	})

	it('runs a selected heading level through the existing command layer', async () => {
		const user = userEvent.setup()
		view = new EditorView({
			parent: document.body,
			state: EditorState.create({
				doc: 'Title',
				selection: EditorSelection.cursor(2),
			}),
		})
		render(
			<EditorToolbar
				editorView={view}
				showLineNumbers={false}
				onToggleLineNumbers={() => undefined}
			/>,
		)

		await user.click(screen.getByRole('button', { name: 'Heading' }))
		await user.click(screen.getByRole('menuitem', { name: 'H2 Heading 2' }))

		expect(view.state.doc.toString()).toBe('## Title')
		expect(view.hasFocus).toBe(true)
	})

	it('supports heading-menu arrow navigation and Escape', async () => {
		const user = userEvent.setup()
		view = new EditorView({ state: EditorState.create({ doc: 'Title' }) })
		render(
			<EditorToolbar
				editorView={view}
				showLineNumbers={false}
				onToggleLineNumbers={() => undefined}
			/>,
		)
		const headingTrigger = screen.getByRole('button', { name: 'Heading' })

		headingTrigger.focus()
		await user.keyboard('{ArrowDown}')
		expect(headingTrigger).toHaveAttribute('aria-expanded', 'true')
		expect(screen.getByRole('menuitem', { name: 'H1 Heading 1' })).toHaveFocus()

		await user.keyboard('{End}')
		expect(screen.getByRole('menuitem', { name: 'H6 Heading 6' })).toHaveFocus()

		await user.keyboard('{Escape}')
		expect(headingTrigger).toHaveAttribute('aria-expanded', 'false')
		expect(headingTrigger).toHaveFocus()
	})

	it('disables formatting controls until the editor is ready', () => {
		render(
			<EditorToolbar
				editorView={null}
				showLineNumbers={false}
				onToggleLineNumbers={() => undefined}
			/>,
		)

		expect(screen.getByRole('button', { name: 'Heading' })).toHaveAttribute(
			'aria-disabled',
			'true',
		)
		expect(screen.getByRole('menuitem', { name: 'H1 Heading 1' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Task list' })).toBeDisabled()
		expect(screen.getByRole('button', { name: '1. Ordered list' })).toBeDisabled()
	})

	it('exposes the line-number preference as a pressed toggle', async () => {
		const user = userEvent.setup()
		const onToggleLineNumbers = vi.fn()
		const { rerender } = render(
			<EditorToolbar
				editorView={null}
				showLineNumbers={false}
				onToggleLineNumbers={onToggleLineNumbers}
			/>,
		)
		const toggle = screen.getByRole('button', { name: 'Toggle line numbers' })

		expect(toggle).toHaveAttribute('aria-pressed', 'false')
		await user.click(toggle)
		expect(onToggleLineNumbers).toHaveBeenCalledOnce()

		rerender(
			<EditorToolbar
				editorView={null}
				showLineNumbers
				onToggleLineNumbers={onToggleLineNumbers}
			/>,
		)
		expect(toggle).toHaveAttribute('aria-pressed', 'true')
	})
})
