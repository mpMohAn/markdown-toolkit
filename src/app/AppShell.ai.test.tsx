import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIProvider } from '../features/ai/AIProvider'

const lifecycle = vi.hoisted(() => ({
	updateContent: vi.fn(),
}))

vi.mock('../features/document/ui/useDocumentLifecycle', () => ({
	useDocumentLifecycle: () => ({
		document: {
			id: 'active-document',
			content: '# Original',
			createdAt: 1,
			updatedAt: 1,
		},
		status: 'saved',
		error: null,
		updateContent: lifecycle.updateContent,
	}),
}))

import { AppShell } from './AppShell'

function createProvider(): AIProvider {
	return {
		getAvailability: vi.fn().mockResolvedValue('available'),
		initialize: vi.fn().mockResolvedValue({ setupDurationMs: 1 }),
		generate: vi.fn().mockResolvedValue({
			text: '# Cleaned',
			generationDurationMs: 1,
			inputLength: 10,
			outputLength: 9,
		}),
		dispose: vi.fn(),
	}
}

describe('AppShell AI integration', () => {
	beforeEach(() => lifecycle.updateContent.mockReset())

	it('applies through the existing document lifecycle update path', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		render(<AppShell aiProviderFactory={() => provider} />)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Improve writing' }))
		await user.click(await screen.findByRole('button', { name: 'Review' }))
		await user.click(await screen.findByRole('button', { name: 'Apply' }))

		expect(lifecycle.updateContent).toHaveBeenCalledOnce()
		expect(lifecycle.updateContent).toHaveBeenCalledWith('# Cleaned')
	})

	it('formats Markdown without invoking the AI provider', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		render(<AppShell aiProviderFactory={() => provider} />)

		await user.click(await screen.findByRole('button', { name: 'Format Markdown' }))

		expect(provider.getAvailability).not.toHaveBeenCalled()
		expect(provider.initialize).not.toHaveBeenCalled()
		expect(provider.generate).not.toHaveBeenCalled()
		expect(screen.queryByRole('dialog', { name: 'AI writing' })).not.toBeInTheDocument()
	})
})
