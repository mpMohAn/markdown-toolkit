import { EditorSelection, EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToolbarMenuProvider } from '../../shared/components/ToolbarMenu'
import { EditorToolbar } from './EditorToolbar'

function renderToolbar(component: React.ReactNode) {
	return render(<ToolbarMenuProvider>{component}</ToolbarMenuProvider>)
}

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
		renderToolbar(
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

	it('formats the complete document locally and restores editor focus', async () => {
		const user = userEvent.setup()
		view = new EditorView({
			parent: document.body,
			state: EditorState.create({ doc: '##   Title\n* item' }),
		})
		renderToolbar(
			<EditorToolbar
				editorView={view}
				showLineNumbers={false}
				onToggleLineNumbers={() => undefined}
			/>,
		)

		await user.click(screen.getByRole('button', { name: 'Format Markdown' }))
		expect(view.state.doc.toString()).toBe('## Title\n- item\n')
		expect(view.hasFocus).toBe(true)
	})

	it('places Insert image immediately after Link and runs it through the command layer', async () => {
		const user = userEvent.setup()
		view = new EditorView({
			parent: document.body,
			state: EditorState.create({
				doc: 'Diagram',
				selection: EditorSelection.range(0, 7),
			}),
		})
		const { container } = renderToolbar(
			<EditorToolbar
				editorView={view}
				showLineNumbers={false}
				onToggleLineNumbers={() => undefined}
			/>,
		)
		const link = screen.getByRole('button', { name: 'Link' })
		const image = screen.getByRole('button', { name: 'Insert image' })
		const inlineCode = screen.getByRole('button', { name: 'Inline code' })

		expect(link.compareDocumentPosition(image) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
		expect(
			image.compareDocumentPosition(inlineCode) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		expect(image).toHaveAttribute('title', 'Insert image')
		expect(container.querySelector('input[type="file"]')).not.toBeInTheDocument()
		await user.click(image)
		expect(view.state.doc.toString()).toBe('![Diagram](https://)')
		expect(view.hasFocus).toBe(true)
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
		renderToolbar(
			<EditorToolbar
				editorView={view}
				showLineNumbers={false}
				onToggleLineNumbers={() => undefined}
			/>,
		)

		await user.click(screen.getByRole('button', { name: 'Text style' }))
		await user.click(screen.getByRole('menuitem', { name: 'Heading 2' }))

		expect(view.state.doc.toString()).toBe('## Title')
		expect(view.hasFocus).toBe(true)
	})

	it('supports heading-menu arrow navigation and Escape', async () => {
		const user = userEvent.setup()
		view = new EditorView({ state: EditorState.create({ doc: 'Title' }) })
		renderToolbar(
			<EditorToolbar
				editorView={view}
				showLineNumbers={false}
				onToggleLineNumbers={() => undefined}
			/>,
		)
		const headingTrigger = screen.getByRole('button', { name: 'Text style' })

		headingTrigger.focus()
		await user.keyboard('{ArrowDown}')
		expect(headingTrigger).toHaveAttribute('aria-expanded', 'true')
		expect(screen.getByRole('menuitem', { name: 'Paragraph' })).toHaveFocus()

		await user.keyboard('{End}')
		expect(screen.getByRole('menuitem', { name: 'Heading 6' })).toHaveFocus()

		await user.keyboard('{Escape}')
		expect(headingTrigger).toHaveAttribute('aria-expanded', 'false')
		expect(headingTrigger).toHaveFocus()
	})

	it('disables formatting controls until the editor is ready', () => {
		renderToolbar(
			<EditorToolbar
				editorView={null}
				showLineNumbers={false}
				onToggleLineNumbers={() => undefined}
			/>,
		)

		expect(screen.getByRole('button', { name: 'Text style' })).toBeDisabled()
		expect(screen.queryByRole('menuitem', { name: 'Heading 1' })).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Task list' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Ordered list' })).toBeDisabled()
		expect(screen.getByRole('button', { name: 'Format Markdown' })).toBeDisabled()
	})

	it.each([1, 2, 3, 4, 5, 6])('applies Heading %s from the text-style menu', async (level) => {
		const user = userEvent.setup()
		view = new EditorView({
			state: EditorState.create({ doc: 'Title', selection: EditorSelection.cursor(2) }),
		})
		renderToolbar(
			<EditorToolbar
				editorView={view}
				showLineNumbers={false}
				onToggleLineNumbers={() => undefined}
			/>,
		)
		await user.click(screen.getByRole('button', { name: 'Text style' }))
		await user.click(screen.getByRole('menuitem', { name: `Heading ${level}` }))
		expect(view.state.doc.toString()).toBe(`${'#'.repeat(level)} Title`)
	})

	it('removes a heading through Paragraph and restores editor focus', async () => {
		const user = userEvent.setup()
		view = new EditorView({
			parent: document.body,
			state: EditorState.create({ doc: '#### Title', selection: EditorSelection.cursor(7) }),
		})
		renderToolbar(
			<EditorToolbar
				editorView={view}
				showLineNumbers={false}
				onToggleLineNumbers={() => undefined}
			/>,
		)
		await user.click(screen.getByRole('button', { name: 'Text style' }))
		await user.click(screen.getByRole('menuitem', { name: 'Paragraph' }))
		expect(view.state.doc.toString()).toBe('Title')
		expect(view.hasFocus).toBe(true)
	})

	it('exposes the line-number preference as a pressed toggle', async () => {
		const user = userEvent.setup()
		const onToggleLineNumbers = vi.fn()
		const { rerender } = renderToolbar(
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
			<ToolbarMenuProvider>
				<EditorToolbar
					editorView={null}
					showLineNumbers
					onToggleLineNumbers={onToggleLineNumbers}
				/>
			</ToolbarMenuProvider>,
		)
		expect(toggle).toHaveAttribute('aria-pressed', 'true')
	})
})
