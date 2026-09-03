import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const lifecycle = vi.hoisted(() => ({
	content: '# **Project** [Notes](https://example.com)',
	updateContent: vi.fn(),
}))

vi.mock('../features/document/ui/useDocumentLifecycle', () => ({
	useDocumentLifecycle: () => ({
		document: {
			id: 'active-document',
			content: lifecycle.content,
			createdAt: 1,
			updatedAt: 1,
		},
		status: 'saved',
		error: null,
		updateContent: lifecycle.updateContent,
	}),
}))

import { AppShell } from './AppShell'

describe('AppShell toolbar', () => {
	beforeEach(() => {
		lifecycle.content = '# **Project** [Notes](https://example.com)'
		lifecycle.updateContent.mockReset()
	})

	it('renders the approved brand and updates the readable filename in one toolbar', () => {
		const view = render(<AppShell />)

		expect(screen.getByRole('toolbar', { name: 'Markdown Toolkit' })).toBeInTheDocument()
		expect(
			screen.getByRole('img', { name: 'Markdown Toolkit' }).querySelector('img'),
		).toHaveAttribute('src', '/favicon-32x32.png')
		expect(screen.getByLabelText('Current document: Project Notes.md')).toHaveTextContent(
			'Project Notes.md',
		)
		expect(screen.getAllByRole('toolbar')).toHaveLength(1)

		lifecycle.content = '# Updated Title'
		view.rerender(<AppShell />)
		expect(screen.getByLabelText('Current document: Updated Title.md')).toBeInTheDocument()
	})

	it('orders the three toolbar regions without duplicated controls', () => {
		render(<AppShell />)
		const toolbar = screen.getByRole('toolbar', { name: 'Markdown Toolkit' })
		const left = toolbar.querySelector('.toolbar-region-left')!
		const centre = toolbar.querySelector('.toolbar-region-center')!
		const right = toolbar.querySelector('.toolbar-region-right')!
		const filename = screen.getByLabelText('Current document: Project Notes.md')
		const copy = screen.getByRole('button', { name: 'Copy' })
		const download = screen.getByRole('button', { name: 'Download' })

		expect(left).toContainElement(screen.getByRole('img', { name: 'Markdown Toolkit' }))
		expect(centre).toContainElement(filename)
		expect(centre).not.toContainElement(copy)
		expect(centre).not.toContainElement(download)
		expect(right).toContainElement(copy)
		expect(right).toContainElement(download)
		expect(
			copy.compareDocumentPosition(download) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy()
		const ai = screen.getByRole('button', { name: 'AI Clean Up' })
		const theme = screen.getByRole('button', { name: /Switch to .* theme/ })
		expect(right).toContainElement(ai)
		expect(right).toContainElement(theme)
		expect(download.compareDocumentPosition(ai) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
		expect(ai.compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
		expect(screen.getAllByRole('button', { name: 'Bold' })).toHaveLength(1)
	})
})
