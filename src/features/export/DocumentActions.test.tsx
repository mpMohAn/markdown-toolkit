import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToolbarMenuProvider } from '../../shared/components/ToolbarMenu'
import { DocumentActions } from './DocumentActions'

function renderActions(content = '# Document') {
	return render(
		<ToolbarMenuProvider>
			<DocumentActions content={content} />
		</ToolbarMenuProvider>,
	)
}

describe('DocumentActions', () => {
	beforeEach(() => {
		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText: vi.fn().mockResolvedValue(undefined) },
		})
		Object.defineProperty(URL, 'createObjectURL', {
			configurable: true,
			value: vi.fn(() => 'blob:document'),
		})
		Object.defineProperty(URL, 'revokeObjectURL', {
			configurable: true,
			value: vi.fn(),
		})
	})

	it('opening menus has no copy or download side effect', async () => {
		const user = userEvent.setup()
		const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined)
		const anchorClick = vi
			.spyOn(HTMLAnchorElement.prototype, 'click')
			.mockImplementation(() => {})
		renderActions()

		await user.click(screen.getByRole('button', { name: 'Copy' }))
		expect(writeText).not.toHaveBeenCalled()
		await user.click(screen.getByRole('button', { name: 'Download' }))
		expect(anchorClick).not.toHaveBeenCalled()
		writeText.mockRestore()
		anchorClick.mockRestore()
	})

	it('runs both existing download actions and closes the menu', async () => {
		const user = userEvent.setup()
		const anchorClick = vi
			.spyOn(HTMLAnchorElement.prototype, 'click')
			.mockImplementation(() => {})
		renderActions('# Document')
		const trigger = screen.getByRole('button', { name: 'Download' })

		await user.click(trigger)
		await user.click(screen.getByRole('menuitem', { name: 'Download Markdown' }))
		expect(anchorClick).toHaveBeenCalledTimes(1)
		expect(trigger).toHaveAttribute('aria-expanded', 'false')
		await user.click(trigger)
		await user.click(screen.getByRole('menuitem', { name: 'Download HTML' }))
		expect(anchorClick).toHaveBeenCalledTimes(2)
		anchorClick.mockRestore()
	})

	it('closes the other dropdown when a menu opens', async () => {
		const user = userEvent.setup()
		renderActions()
		const copyTrigger = screen.getByRole('button', { name: 'Copy' })
		const downloadTrigger = screen.getByRole('button', { name: 'Download' })

		await user.click(copyTrigger)
		await waitFor(() => expect(copyTrigger).toHaveAttribute('aria-expanded', 'true'))
		expect(downloadTrigger).toHaveAttribute('aria-expanded', 'false')

		await user.click(downloadTrigger)
		await waitFor(() => expect(downloadTrigger).toHaveAttribute('aria-expanded', 'true'))
		expect(copyTrigger).toHaveAttribute('aria-expanded', 'false')
	})

	it('supports arrow navigation and Escape with focus return', async () => {
		const user = userEvent.setup()
		renderActions()
		const copyTrigger = screen.getByRole('button', { name: 'Copy' })

		copyTrigger.focus()
		await user.keyboard('{ArrowDown}')
		expect(copyTrigger).toHaveAttribute('aria-expanded', 'true')
		expect(screen.getByRole('menuitem', { name: 'Copy Markdown' })).toHaveFocus()

		await user.keyboard('{ArrowDown}')
		expect(screen.getByRole('menuitem', { name: 'Copy HTML' })).toHaveFocus()

		await user.keyboard('{Escape}')
		expect(copyTrigger).toHaveAttribute('aria-expanded', 'false')
		expect(copyTrigger).toHaveFocus()
	})

	it('uses compact visible labels with descriptive accessible names', async () => {
		const user = userEvent.setup()
		renderActions()

		await user.click(screen.getByRole('button', { name: 'Copy' }))
		expect(screen.getByRole('menuitem', { name: 'Copy Markdown' })).toHaveTextContent(/^MD$/)
		expect(screen.getByRole('menuitem', { name: 'Copy HTML' })).toHaveTextContent(/^HTML$/)
		await user.click(screen.getByRole('button', { name: 'Download' }))
		expect(screen.getByRole('menuitem', { name: 'Download Markdown' })).toHaveTextContent(
			/^MD$/,
		)
		expect(screen.getByRole('menuitem', { name: 'Download HTML' })).toHaveTextContent(/^HTML$/)
	})

	it('announces copy success and failure without losing trigger focus', async () => {
		const user = userEvent.setup()
		const { rerender } = renderActions()
		const copyTrigger = screen.getByRole('button', { name: 'Copy' })

		await user.click(copyTrigger)
		await user.click(screen.getByRole('menuitem', { name: 'Copy Markdown' }))
		expect(await screen.findByRole('status')).toHaveTextContent('Markdown copied')
		expect(copyTrigger).toHaveFocus()

		Object.defineProperty(navigator, 'clipboard', {
			configurable: true,
			value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) },
		})
		rerender(
			<ToolbarMenuProvider>
				<DocumentActions content="# Document" />
			</ToolbarMenuProvider>,
		)
		await user.click(copyTrigger)
		await user.click(screen.getByRole('menuitem', { name: 'Copy HTML' }))
		expect(await screen.findByRole('status')).toHaveTextContent('Copy failed')
		expect(copyTrigger).toHaveFocus()
	})
})
