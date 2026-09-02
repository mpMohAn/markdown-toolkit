import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AIProvider } from './AIProvider'
import { AICleanup } from './AICleanup'

function createProvider(options?: { output?: string; error?: Error }): AIProvider {
	return {
		getAvailability: vi.fn().mockResolvedValue('available'),
		initialize: vi.fn().mockResolvedValue({ setupDurationMs: 3 }),
		generate: options?.error
			? vi.fn().mockRejectedValue(options.error)
			: vi.fn().mockResolvedValue({
					text: options?.output ?? '# Cleaned',
					generationDurationMs: 4,
					inputLength: 100,
					outputLength: 9,
				}),
		dispose: vi.fn(),
	}
}

function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (error: Error) => void
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})
	return { promise, resolve, reject }
}

async function generateSuggestion(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole('button', { name: 'AI Clean Up' }))
	await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
	await user.click(await screen.findByRole('button', { name: 'Run Clean Up' }))
	return screen.findByLabelText('AI suggestion')
}

describe('AICleanup', () => {
	it('keeps the original untouched until Apply, then uses the supplied update path', async () => {
		const user = userEvent.setup()
		const onApply = vi.fn()
		render(<AICleanup content="# Original" onApply={onApply} provider={createProvider()} />)

		await generateSuggestion(user)
		expect(onApply).not.toHaveBeenCalled()
		expect(screen.getByLabelText('Original Markdown')).toHaveTextContent('# Original')

		await user.click(screen.getByRole('button', { name: 'Apply' }))
		expect(onApply).toHaveBeenCalledOnce()
		expect(onApply).toHaveBeenCalledWith('# Cleaned')
	})

	it('discards the suggestion on Cancel', async () => {
		const user = userEvent.setup()
		const onApply = vi.fn()
		render(<AICleanup content="# Original" onApply={onApply} provider={createProvider()} />)

		await generateSuggestion(user)
		await user.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(onApply).not.toHaveBeenCalled()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	})

	it('disables cleanup for an empty document', () => {
		const provider = createProvider()
		render(<AICleanup content={' \n '} onApply={vi.fn()} provider={provider} />)
		expect(screen.getByRole('button', { name: 'AI Clean Up' })).toBeDisabled()
		expect(provider.initialize).not.toHaveBeenCalled()
	})

	it('never modifies the document when generation fails', async () => {
		const user = userEvent.setup()
		const onApply = vi.fn()
		render(
			<AICleanup
				content="# Original"
				onApply={onApply}
				provider={createProvider({ error: new Error('Model failed') })}
			/>,
		)

		await user.click(screen.getByRole('button', { name: 'AI Clean Up' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Run Clean Up' }))

		expect(await screen.findByRole('alert')).toHaveTextContent('Model failed')
		expect(onApply).not.toHaveBeenCalled()
	})

	it('shows setup and generation as distinct states', async () => {
		const user = userEvent.setup()
		const setup = deferred<{ setupDurationMs: number }>()
		const provider = createProvider()
		provider.initialize = vi.fn().mockReturnValue(setup.promise)
		provider.generate = vi.fn().mockReturnValue(new Promise(() => undefined))
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI Clean Up' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		expect(screen.getByRole('status')).toHaveTextContent('Preparing local AI')

		setup.resolve({ setupDurationMs: 10 })
		await user.click(await screen.findByRole('button', { name: 'Run Clean Up' }))
		expect(screen.getByRole('status')).toHaveTextContent('Generating suggestion')
	})

	it('renders streamed output while Apply remains disabled until completion', async () => {
		const user = userEvent.setup()
		const generation = deferred<{
			text: string
			generationDurationMs: number
			inputLength: number
			outputLength: number
		}>()
		const provider = createProvider()
		provider.generate = vi.fn().mockImplementation((_prompt, options) => {
			options?.onUpdate?.('# Partial')
			return generation.promise
		})
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI Clean Up' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Run Clean Up' }))
		await waitFor(() =>
			expect(screen.getByLabelText('AI suggestion')).toHaveTextContent('# Partial'),
		)
		expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()

		generation.resolve({
			text: '# Complete',
			generationDurationMs: 20,
			inputLength: 100,
			outputLength: 10,
		})
		await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled())
		expect(screen.getByLabelText('AI suggestion')).toHaveTextContent('# Complete')
	})

	it('aborts generation and discards partial output on Cancel', async () => {
		const user = userEvent.setup()
		const onApply = vi.fn()
		const provider = createProvider()
		let generationSignal: AbortSignal | undefined
		provider.generate = vi.fn().mockImplementation((_prompt, options) => {
			generationSignal = options?.signal
			options?.onUpdate?.('# Incomplete')
			return new Promise(() => undefined)
		})
		render(<AICleanup content="# Original" onApply={onApply} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI Clean Up' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Run Clean Up' }))
		await user.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(generationSignal?.aborted).toBe(true)
		expect(onApply).not.toHaveBeenCalled()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	})

	it('aborts model setup when Cancel is used while preparing', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		let setupSignal: AbortSignal | undefined
		provider.initialize = vi.fn().mockImplementation((_systemPrompt, options) => {
			setupSignal = options?.signal
			return new Promise(() => undefined)
		})
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI Clean Up' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(screen.getByRole('button', { name: 'Cancel' }))

		expect(setupSignal?.aborted).toBe(true)
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	})

	it('stops stalled setup and retries with a fresh controlled attempt', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		const setupSignals: AbortSignal[] = []
		provider.initialize = vi.fn().mockImplementation((_systemPrompt, options) => {
			setupSignals.push(options.signal)
			return new Promise(() => undefined)
		})
		render(
			<AICleanup
				content="# Original"
				onApply={vi.fn()}
				provider={provider}
				setupWatchdogMs={20}
			/>,
		)

		await user.click(screen.getByRole('button', { name: 'AI Clean Up' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			"Local AI couldn't become ready on this browser or device.",
		)
		expect(setupSignals[0]?.aborted).toBe(true)

		await user.click(screen.getByRole('button', { name: 'Try Again' }))
		expect(provider.initialize).toHaveBeenCalledTimes(2)
		expect(setupSignals[1]).not.toBe(setupSignals[0])
	})

	it('resets the setup watchdog when download progress advances', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		let reportProgress: ((progress: number) => void) | undefined
		provider.initialize = vi.fn().mockImplementation((_systemPrompt, options) => {
			reportProgress = options.onDownloadProgress
			return new Promise(() => undefined)
		})
		render(
			<AICleanup
				content="# Original"
				onApply={vi.fn()}
				provider={provider}
				setupWatchdogMs={40_000}
			/>,
		)

		await user.click(screen.getByRole('button', { name: 'AI Clean Up' }))
		const enableButton = await screen.findByRole('button', { name: 'Enable AI' })
		vi.useFakeTimers()
		try {
			fireEvent.click(enableButton)
			act(() => vi.advanceTimersByTime(30_000))
			act(() => reportProgress?.(0.25))
			act(() => vi.advanceTimersByTime(30_000))
			expect(screen.queryByRole('alert')).not.toBeInTheDocument()
			act(() => vi.advanceTimersByTime(10_001))
			expect(screen.getByRole('alert')).toHaveTextContent("couldn't become ready")
		} finally {
			vi.useRealTimers()
		}
	})

	it('keeps development metrics free of Markdown contents', async () => {
		const user = userEvent.setup()
		const secretSource = '# PRIVATE_MARKDOWN_VALUE'
		render(<AICleanup content={secretSource} onApply={vi.fn()} provider={createProvider()} />)

		await generateSuggestion(user)
		await user.click(screen.getByText('POC metrics'))
		const metrics = screen.getByText('POC metrics').closest('details')
		expect(metrics).not.toHaveTextContent('PRIVATE_MARKDOWN_VALUE')
		expect(metrics).toHaveTextContent('inputCharacters')
		expect(metrics).toHaveTextContent(String(secretSource.length))
	})
})
