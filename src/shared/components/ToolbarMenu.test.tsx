import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ToolbarMenu, ToolbarMenuProvider } from './ToolbarMenu'

function Menus({ onSelect = () => undefined }: { onSelect?: () => void }) {
	return (
		<ToolbarMenuProvider>
			<ToolbarMenu
				id="first"
				label="First menu"
				triggerContent="First"
				items={[
					{ id: 'one', label: 'One', onSelect },
					{ id: 'disabled', label: 'Disabled', disabled: true, onSelect },
					{ id: 'two', label: 'Two', onSelect },
				]}
			/>
			<ToolbarMenu
				id="second"
				label="Second menu"
				triggerContent="Second"
				items={[{ id: 'three', label: 'Three', onSelect }]}
			/>
		</ToolbarMenuProvider>
	)
}

describe('ToolbarMenu', () => {
	it('toggles by click and keeps only one menu open', async () => {
		const user = userEvent.setup()
		render(<Menus />)
		const first = screen.getByRole('button', { name: 'First menu' })
		const second = screen.getByRole('button', { name: 'Second menu' })

		await user.click(first)
		expect(first).toHaveAttribute('aria-expanded', 'true')
		await user.click(first)
		expect(first).toHaveAttribute('aria-expanded', 'false')
		await user.click(first)
		await user.click(second)
		expect(first).toHaveAttribute('aria-expanded', 'false')
		expect(second).toHaveAttribute('aria-expanded', 'true')
	})

	it('closes outside but activates an item before closing', async () => {
		const user = userEvent.setup()
		const onSelect = vi.fn()
		render(<Menus onSelect={onSelect} />)
		const trigger = screen.getByRole('button', { name: 'First menu' })

		await user.click(trigger)
		await user.click(screen.getByRole('menuitem', { name: 'One' }))
		expect(onSelect).toHaveBeenCalledOnce()
		expect(trigger).toHaveAttribute('aria-expanded', 'false')

		await user.click(trigger)
		fireEvent.pointerDown(document.body)
		expect(trigger).toHaveAttribute('aria-expanded', 'false')
	})

	it('supports trigger and menu keyboard navigation', async () => {
		const user = userEvent.setup()
		render(<Menus />)
		const trigger = screen.getByRole('button', { name: 'First menu' })

		trigger.focus()
		await user.keyboard('{ArrowDown}')
		expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus()
		await user.keyboard('{End}')
		expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus()
		await user.keyboard('{Home}')
		expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus()
		await user.keyboard('{ArrowUp}')
		expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus()
		await user.keyboard('{Escape}')
		expect(trigger).toHaveFocus()
		expect(trigger).toHaveAttribute('aria-expanded', 'false')

		await user.keyboard('{Enter}')
		expect(trigger).toHaveAttribute('aria-expanded', 'true')
		await user.keyboard('{Escape}')
		await user.keyboard(' ')
		expect(trigger).toHaveAttribute('aria-expanded', 'true')
	})

	it('closes on Tab without trapping focus', async () => {
		const user = userEvent.setup()
		render(<Menus />)
		const trigger = screen.getByRole('button', { name: 'First menu' })
		await user.click(trigger)
		screen.getByRole('menuitem', { name: 'One' }).focus()
		await user.tab()
		expect(trigger).toHaveAttribute('aria-expanded', 'false')
	})

	it('cleans the outside-pointer listener under Strict Mode', async () => {
		const user = userEvent.setup()
		const addSpy = vi.spyOn(document, 'addEventListener')
		const removeSpy = vi.spyOn(document, 'removeEventListener')
		const view = render(
			<StrictMode>
				<Menus />
			</StrictMode>,
		)
		await user.click(screen.getByRole('button', { name: 'First menu' }))
		view.unmount()

		const added = addSpy.mock.calls.filter(([type]) => type === 'pointerdown').length
		const removed = removeSpy.mock.calls.filter(([type]) => type === 'pointerdown').length
		expect(added).toBeGreaterThan(0)
		expect(removed).toBe(added)
		addSpy.mockRestore()
		removeSpy.mockRestore()
	})

	it('supports safe external links and skips separators during keyboard navigation', async () => {
		const user = userEvent.setup()
		render(
			<ToolbarMenuProvider>
				<ToolbarMenu
					id="links"
					label="Links"
					triggerContent="Links"
					items={[
						{ id: 'action', label: 'Action', onSelect: vi.fn() },
						{ id: 'separator', type: 'separator' },
						{
							id: 'external',
							label: 'External',
							href: 'https://example.com/',
							target: '_blank',
							rel: 'noopener noreferrer',
						},
					]}
				/>
			</ToolbarMenuProvider>,
		)

		const trigger = screen.getByRole('button', { name: 'Links' })
		trigger.focus()
		await user.keyboard('{ArrowDown}{ArrowDown}')
		const link = screen.getByRole('menuitem', { name: 'External' })
		expect(link).toHaveFocus()
		expect(link).toHaveAttribute('target', '_blank')
		expect(link).toHaveAttribute('rel', 'noopener noreferrer')
		expect(screen.getByRole('separator')).toBeInTheDocument()
	})
})
