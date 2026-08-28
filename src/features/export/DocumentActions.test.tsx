import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentActions } from './DocumentActions'

describe('DocumentActions', () => {
	beforeEach(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText: vi.fn().mockResolvedValue(undefined) },
		})
	})

	it('closes the other dropdown when a menu opens', async () => {
		const user = userEvent.setup()
		render(<DocumentActions content="# Document" />)
		const copyMenu = screen.getByText('Copy ▾').closest('details')!
		const downloadMenu = screen.getByText('Download ▾').closest('details')!

		await user.click(screen.getByText('Copy ▾'))
		await waitFor(() => expect(copyMenu).toHaveAttribute('open'))
		expect(downloadMenu).not.toHaveAttribute('open')

		await user.click(screen.getByText('Download ▾'))
		await waitFor(() => expect(downloadMenu).toHaveAttribute('open'))
		expect(copyMenu).not.toHaveAttribute('open')
	})

	it('supports arrow navigation and Escape with focus return', async () => {
		const user = userEvent.setup()
		render(<DocumentActions content="# Document" />)
		const copyTrigger = screen.getByRole('button', { name: 'Copy ▾' })

		copyTrigger.focus()
		await user.keyboard('{ArrowDown}')
		expect(copyTrigger).toHaveAttribute('aria-expanded', 'true')
		expect(screen.getByRole('menuitem', { name: 'Markdown' })).toHaveFocus()

		await user.keyboard('{ArrowDown}')
		expect(screen.getByRole('menuitem', { name: 'HTML' })).toHaveFocus()

		await user.keyboard('{Escape}')
		expect(copyTrigger).toHaveAttribute('aria-expanded', 'false')
		expect(copyTrigger).toHaveFocus()
	})

	it('announces copy success and failure without losing trigger focus', async () => {
		const user = userEvent.setup()
		const { rerender } = render(<DocumentActions content="# Document" />)
		const copyTrigger = screen.getByRole('button', { name: 'Copy ▾' })

		await user.click(copyTrigger)
		await user.click(screen.getByRole('menuitem', { name: 'Markdown' }))
		expect(await screen.findByRole('status')).toHaveTextContent('Markdown copied')
		expect(copyTrigger).toHaveFocus()

		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
		})
		rerender(<DocumentActions content="# Document" />)
		await user.click(copyTrigger)
		await user.click(screen.getByRole('menuitem', { name: 'HTML' }))
		expect(await screen.findByRole('status')).toHaveTextContent('Copy failed')
		expect(copyTrigger).toHaveFocus()
	})
})
