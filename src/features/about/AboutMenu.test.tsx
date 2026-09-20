import { StrictMode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import indexHtml from '../../../index.html?raw'
import { ToolbarMenuProvider } from '../../shared/components/ToolbarMenu'
import { AboutMenu } from './AboutMenu'

function renderAboutMenu(strict = false) {
	const content = (
		<div className="app-shell">
			<ToolbarMenuProvider>
				<AboutMenu />
			</ToolbarMenuProvider>
			<main>
				<button type="button">Background action</button>
			</main>
		</div>
	)
	return render(strict ? <StrictMode>{content}</StrictMode> : content)
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
	const trigger = screen.getByRole('button', { name: 'About Markdown Toolkit' })
	await user.click(trigger)
	return trigger
}

describe('AboutMenu', () => {
	it('renders a compact accessible control with the locally bundled info icon', () => {
		renderAboutMenu()
		const trigger = screen.getByRole('button', { name: 'About Markdown Toolkit' })
		expect(trigger).toHaveAttribute('title', 'About Markdown Toolkit')
		const icon = trigger.querySelector<HTMLElement>('.material-icon')
		expect(icon).toHaveAttribute('aria-hidden', 'true')
		expect(icon?.style.getPropertyValue('--material-icon-source')).toContain(
			'data:image/svg+xml',
		)
		expect(icon?.style.getPropertyValue('--material-icon-source')).not.toMatch(/^url\("https?:/)
	})

	it('orders menu items, includes a separator, and uses safe fixed external links', async () => {
		const user = userEvent.setup()
		renderAboutMenu()
		await openMenu(user)

		expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
			'About Markdown Toolkit',
			'Privacy',
			'GitHub repository',
			'Report an issue',
			'Support Markdown Toolkit',
		])
		expect(screen.getByRole('separator')).toBeInTheDocument()
		const expectedLinks = [
			['GitHub repository', 'https://github.com/mpMohAn/markdown-toolkit'],
			['Report an issue', 'https://github.com/mpMohAn/markdown-toolkit/issues/new'],
			['Support Markdown Toolkit', 'https://github.com/sponsors/mpMohAn'],
		]
		for (const [name, href] of expectedLinks) {
			const link = screen.getByRole('menuitem', { name })
			expect(link).toHaveAttribute('href', href)
			expect(link).toHaveAttribute('target', '_blank')
			expect(link).toHaveAttribute('rel', 'noopener noreferrer')
			expect(link.getAttribute('href')).not.toContain('PRIVATE_MARKDOWN')
		}
	})

	it('toggles, closes outside and on Escape, and supports menu keyboard navigation', async () => {
		const user = userEvent.setup()
		renderAboutMenu()
		const trigger = screen.getByRole('button', { name: 'About Markdown Toolkit' })

		await user.click(trigger)
		expect(trigger).toHaveAttribute('aria-expanded', 'true')
		await user.click(trigger)
		expect(trigger).toHaveAttribute('aria-expanded', 'false')

		trigger.focus()
		await user.keyboard('{ArrowDown}')
		expect(screen.getByRole('menuitem', { name: 'About Markdown Toolkit' })).toHaveFocus()
		await user.keyboard('{End}')
		expect(screen.getByRole('menuitem', { name: 'Support Markdown Toolkit' })).toHaveFocus()
		await user.keyboard('{Home}')
		expect(screen.getByRole('menuitem', { name: 'About Markdown Toolkit' })).toHaveFocus()
		await user.keyboard('{Escape}')
		expect(trigger).toHaveFocus()

		await user.click(trigger)
		fireEvent.pointerDown(document.body)
		expect(trigger).toHaveAttribute('aria-expanded', 'false')
	})

	it('shows the concise About dialog with package version and restores focus', async () => {
		const user = userEvent.setup()
		renderAboutMenu()
		const trigger = await openMenu(user)
		await user.click(screen.getByRole('menuitem', { name: 'About Markdown Toolkit' }))

		const dialog = screen.getByRole('dialog', { name: 'Markdown Toolkit' })
		expect(dialog).toHaveClass('about-dialog')
		expect(dialog).toHaveTextContent(
			'A private, browser-based Markdown editor with live preview, Mermaid diagrams, local exports and optional Chrome built-in AI writing.',
		)
		expect(dialog).toHaveTextContent('1.0.0')
		expect(dialog).toHaveTextContent('Mohan Pattar')
		const close = screen.getByRole('button', { name: 'Close Markdown Toolkit' })
		expect(close).toHaveFocus()
		expect(trigger.closest('.app-shell')).toHaveAttribute('inert')

		await user.click(close)
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(trigger).toHaveFocus()
		expect(trigger.closest('.app-shell')).not.toHaveAttribute('inert')
	})

	it('contains focus and closes the dialog with Escape or backdrop activation', async () => {
		const user = userEvent.setup()
		renderAboutMenu()
		const trigger = await openMenu(user)
		await user.click(screen.getByRole('menuitem', { name: 'About Markdown Toolkit' }))
		const close = screen.getByRole('button', { name: 'Close Markdown Toolkit' })
		const repository = screen.getByRole('link', { name: 'GitHub repository' })

		close.focus()
		await user.tab({ shift: true })
		expect(repository).toHaveFocus()
		await user.tab()
		expect(close).toHaveFocus()
		screen.getByRole('button', { name: 'Background action' }).focus()
		expect(close).toHaveFocus()
		await user.keyboard('{Escape}')
		expect(trigger).toHaveFocus()

		await openMenu(user)
		await user.click(screen.getByRole('menuitem', { name: 'Privacy' }))
		fireEvent.mouseDown(document.querySelector('.app-dialog-backdrop')!)
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(trigger).toHaveFocus()
	})

	it('shows all substantive privacy boundaries and stable resource links', async () => {
		const user = userEvent.setup()
		renderAboutMenu()
		await openMenu(user)
		await user.click(screen.getByRole('menuitem', { name: 'Privacy' }))

		const dialog = screen.getByRole('dialog', { name: 'Privacy' })
		expect(dialog).toHaveClass('privacy-dialog')
		for (const heading of [
			'Documents',
			'Chrome built-in AI',
			'Web Analytics',
			'External content',
		]) {
			expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
		}
		expect(dialog).toHaveTextContent('stored locally in your browser')
		expect(dialog).toHaveTextContent('no application server for storing documents')
		expect(dialog).toHaveTextContent("Chrome's local AI runtime")
		expect(dialog).toHaveTextContent('Only the separate AI-enabled preference is persisted')
		expect(dialog).toHaveTextContent('Cloudflare Web Analytics')
		expect(dialog).toHaveTextContent('No custom feature-click analytics are implemented')
		expect(dialog).toHaveTextContent('Remote images')
		expect(
			screen.getByRole('link', { name: 'Cloudflare Web Analytics documentation' }),
		).toHaveAttribute('href', 'https://developers.cloudflare.com/web-analytics/')
	})

	it('cleans dialog listeners under Strict Mode', async () => {
		const user = userEvent.setup()
		const addSpy = vi.spyOn(document, 'addEventListener')
		const removeSpy = vi.spyOn(document, 'removeEventListener')
		const view = renderAboutMenu(true)
		await openMenu(user)
		await user.click(screen.getByRole('menuitem', { name: 'Privacy' }))
		view.unmount()

		for (const type of ['keydown', 'focusin']) {
			const added = addSpy.mock.calls.filter(([eventType]) => eventType === type).length
			const removed = removeSpy.mock.calls.filter(([eventType]) => eventType === type).length
			expect(removed).toBe(added)
		}
	})

	it('does not manually embed analytics or external icon runtimes', () => {
		expect(indexHtml).not.toMatch(
			/cloudflareinsights|beacon\.min\.js|google-analytics|googletagmanager/i,
		)
		expect(indexHtml).not.toMatch(/fonts\.googleapis|fonts\.gstatic|material-icons/i)
	})
})
