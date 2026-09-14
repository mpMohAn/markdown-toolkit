import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIGenerationResult, AIProvider } from './AIProvider'
import { AIProviderError } from './AIProvider'
import { AICleanup } from './AICleanup'
import { AI_ENABLED_PREFERENCE_KEY } from './aiPreferences'
import { ChromeBuiltInAIProvider } from './chromeBuiltInAIProvider'

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
	await user.click(screen.getByRole('button', { name: 'AI writing' }))
	await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
	await user.click(await screen.findByRole('button', { name: 'Improve writing' }))
	await user.click(await screen.findByRole('button', { name: 'Review' }))
	return screen.findByLabelText('AI suggestion')
}

describe('AICleanup', () => {
	const storage = new Map<string, string>()

	beforeEach(() => {
		storage.clear()
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
				removeItem: (key: string) => storage.delete(key),
			},
		})
	})

	it('uses a fresh provider for the second StrictMode effect lifecycle', async () => {
		const user = userEvent.setup()
		const firstProvider = createProvider()
		const secondProvider = createProvider()
		const providers = [firstProvider, secondProvider]
		const providerFactory = vi.fn(() => {
			const provider = providers.shift()
			if (!provider) throw new Error('Unexpected provider lifecycle')
			return provider
		})
		const view = render(
			<StrictMode>
				<AICleanup
					content="# Original"
					onApply={vi.fn()}
					providerFactory={providerFactory}
				/>
			</StrictMode>,
		)

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		expect(await screen.findByRole('button', { name: 'Enable AI' })).toBeInTheDocument()
		expect(providerFactory).toHaveBeenCalledTimes(2)
		expect(firstProvider.dispose).toHaveBeenCalledOnce()
		expect(secondProvider.dispose).not.toHaveBeenCalled()
		expect(firstProvider.getAvailability).not.toHaveBeenCalled()
		expect(secondProvider.getAvailability).toHaveBeenCalledOnce()

		view.unmount()
		expect(secondProvider.dispose).toHaveBeenCalledOnce()
	})

	it('does not check capability or create a session during page load', () => {
		const provider = createProvider()
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)
		expect(screen.getByRole('button', { name: 'AI writing' })).toHaveAttribute(
			'title',
			'AI writing',
		)
		expect(provider.getAvailability).not.toHaveBeenCalled()
		expect(provider.initialize).not.toHaveBeenCalled()
	})

	it('shows Enable AI on first visit and persists only after successful setup', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		render(<AICleanup content="# PRIVATE" onApply={vi.fn()} provider={provider} />)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		expect(await screen.findByRole('button', { name: 'Enable AI' })).toBeInTheDocument()
		expect(provider.initialize).not.toHaveBeenCalled()
		expect(storage).toHaveLength(0)

		await user.click(screen.getByRole('button', { name: 'Enable AI' }))
		expect(await screen.findByRole('button', { name: 'Improve writing' })).toBeInTheDocument()
		expect(storage).toEqual(new Map([[AI_ENABLED_PREFERENCE_KEY, 'true']]))
		expect(JSON.stringify([...storage])).not.toContain('PRIVATE')
	})

	it('remembered enablement prepares visibly on dialog open, never on page load', async () => {
		window.localStorage.setItem(AI_ENABLED_PREFERENCE_KEY, 'true')
		const user = userEvent.setup()
		const availability = deferred<'available'>()
		const setup = deferred<{ setupDurationMs: number }>()
		const provider = createProvider()
		provider.getAvailability = vi.fn().mockReturnValue(availability.promise)
		provider.initialize = vi.fn().mockReturnValue(setup.promise)
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)

		expect(provider.getAvailability).not.toHaveBeenCalled()
		expect(provider.initialize).not.toHaveBeenCalled()
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		expect(screen.getByRole('status')).toHaveTextContent('Checking local AI availability')
		expect(provider.initialize).not.toHaveBeenCalled()

		availability.resolve('available')
		await waitFor(() =>
			expect(screen.getByRole('status')).toHaveTextContent('Preparing local AI'),
		)
		expect(provider.initialize).toHaveBeenCalledOnce()
		setup.resolve({ setupDurationMs: 1 })
		expect(await screen.findByRole('button', { name: 'Improve writing' })).toBeInTheDocument()
	})

	it('aborts remembered setup on close and disposes its provider on unmount', async () => {
		window.localStorage.setItem(AI_ENABLED_PREFERENCE_KEY, 'true')
		const user = userEvent.setup()
		const provider = createProvider()
		let setupSignal: AbortSignal | undefined
		provider.initialize = vi.fn().mockImplementation((_prompt, options) => {
			setupSignal = options?.signal
			return new Promise(() => undefined)
		})
		const view = render(
			<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />,
		)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		expect(await screen.findByRole('status')).toHaveTextContent('Preparing local AI')
		await user.click(screen.getByRole('button', { name: 'Close AI writing' }))
		expect(setupSignal?.aborted).toBe(true)
		expect(provider.dispose).not.toHaveBeenCalled()
		view.unmount()
		expect(provider.dispose).toHaveBeenCalledOnce()
	})

	it('uses a fresh provider and runtime session after a remembered remount', async () => {
		window.localStorage.setItem(AI_ENABLED_PREFERENCE_KEY, 'true')
		const user = userEvent.setup()
		const firstProvider = createProvider()
		const first = render(
			<AICleanup
				content="# Original"
				onApply={vi.fn()}
				providerFactory={() => firstProvider}
			/>,
		)
		expect(firstProvider.initialize).not.toHaveBeenCalled()
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		expect(await screen.findByRole('button', { name: 'Improve writing' })).toBeInTheDocument()
		expect(firstProvider.initialize).toHaveBeenCalledOnce()
		first.unmount()
		expect(firstProvider.dispose).toHaveBeenCalledOnce()

		const secondProvider = createProvider()
		render(
			<AICleanup
				content="# Original"
				onApply={vi.fn()}
				providerFactory={() => secondProvider}
			/>,
		)
		expect(secondProvider.initialize).not.toHaveBeenCalled()
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		expect(await screen.findByRole('button', { name: 'Improve writing' })).toBeInTheDocument()
		expect(secondProvider.initialize).toHaveBeenCalledOnce()
	})

	it.each(['unsupported', 'unavailable'] as const)(
		'runtime %s overrides remembered enablement',
		async (availability) => {
			window.localStorage.setItem(AI_ENABLED_PREFERENCE_KEY, 'true')
			const user = userEvent.setup()
			const provider = createProvider()
			provider.getAvailability = vi.fn().mockResolvedValue(availability)
			render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)
			await user.click(screen.getByRole('button', { name: 'AI writing' }))
			expect(
				await screen.findByText(/requires a supported Chrome|is unavailable/),
			).toBeInTheDocument()
			expect(provider.initialize).not.toHaveBeenCalled()
		},
	)

	it('an unknown runtime availability overrides remembered enablement', async () => {
		window.localStorage.setItem(AI_ENABLED_PREFERENCE_KEY, 'true')
		const user = userEvent.setup()
		const create = vi.fn()
		const provider = new ChromeBuiltInAIProvider({
			LanguageModel: {
				availability: vi.fn().mockResolvedValue('unexpected-runtime-value'),
				create,
			},
		})
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		expect(await screen.findByText(/requires a supported Chrome/)).toBeInTheDocument()
		expect(create).not.toHaveBeenCalled()
	})

	it('falls back safely when preference reading fails', async () => {
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: {
				getItem: () => {
					throw new DOMException('private storage detail', 'SecurityError')
				},
				setItem: (key: string, value: string) => storage.set(key, value),
			},
		})
		const user = userEvent.setup()
		const provider = createProvider()
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		expect(await screen.findByRole('button', { name: 'Enable AI' })).toBeInTheDocument()
	})

	it('keeps a successful runtime session ready when preference writing fails', async () => {
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: () => {
					throw new DOMException('private storage detail', 'QuotaExceededError')
				},
			},
		})
		const user = userEvent.setup()
		const provider = createProvider()
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		expect(await screen.findByRole('button', { name: 'Improve writing' })).toBeInTheDocument()
	})

	it('times out availability independently and retries with a fresh operation', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		provider.getAvailability = vi
			.fn()
			.mockReturnValueOnce(new Promise(() => undefined))
			.mockResolvedValueOnce('available')
		render(
			<AICleanup
				content="# Original"
				onApply={vi.fn()}
				provider={provider}
				availabilityWatchdogMs={20}
			/>,
		)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Local AI availability could not be checked',
		)
		expect(provider.initialize).not.toHaveBeenCalled()
		await user.click(screen.getByRole('button', { name: 'Retry' }))
		expect(await screen.findByRole('button', { name: 'Enable AI' })).toBeInTheDocument()
		expect(provider.getAvailability).toHaveBeenCalledTimes(2)
		expect(provider.initialize).not.toHaveBeenCalled()
	})

	it('ignores a late availability result after timeout', async () => {
		const user = userEvent.setup()
		const availability = deferred<'unsupported'>()
		const provider = createProvider()
		provider.getAvailability = vi.fn().mockReturnValue(availability.promise)
		render(
			<AICleanup
				content="# Original"
				onApply={vi.fn()}
				provider={provider}
				availabilityWatchdogMs={20}
			/>,
		)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		expect(await screen.findByRole('alert')).toHaveTextContent('could not be checked')
		availability.resolve('unsupported')
		await act(async () => availability.promise)
		expect(screen.getByRole('alert')).toHaveTextContent('could not be checked')
		expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
	})

	it('invalidates availability when the dialog closes and on unmount', async () => {
		const user = userEvent.setup()
		const availability = deferred<'available'>()
		const provider = createProvider()
		provider.getAvailability = vi.fn().mockReturnValue(availability.promise)
		const view = render(
			<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />,
		)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(screen.getByRole('button', { name: 'Close AI writing' }))
		availability.resolve('available')
		await act(async () => availability.promise)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		expect(await screen.findByRole('button', { name: 'Enable AI' })).toBeInTheDocument()
		expect(provider.getAvailability).toHaveBeenCalledTimes(2)
		view.unmount()
		expect(provider.dispose).toHaveBeenCalledOnce()
	})

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

	it('preserves a completed suggestion when the review is closed', async () => {
		const user = userEvent.setup()
		const onApply = vi.fn()
		render(<AICleanup content="# Original" onApply={onApply} provider={createProvider()} />)

		await generateSuggestion(user)
		await user.click(screen.getByRole('button', { name: 'Close AI writing' }))

		expect(onApply).not.toHaveBeenCalled()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'AI writing: review ready' }))
		expect(screen.getByLabelText('AI suggestion')).toHaveTextContent('# Cleaned')
	})

	it('disables cleanup for an empty document', () => {
		const provider = createProvider()
		render(<AICleanup content={' \n '} onApply={vi.fn()} provider={provider} />)
		expect(screen.getByRole('button', { name: 'AI writing' })).toBeDisabled()
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

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Summarize' }))
		expect(await screen.findByText('AI writing failed')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'AI writing: action failed' })).toHaveAttribute(
			'title',
			'AI writing: action failed',
		)
		await user.click(await screen.findByRole('button', { name: 'Open' }))

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Local AI could not complete this writing action',
		)
		expect(screen.getByRole('alert')).not.toHaveTextContent('Model failed')
		expect(onApply).not.toHaveBeenCalled()
	})

	it('retains the selected action when generation is retried', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		provider.generate = vi
			.fn()
			.mockRejectedValueOnce(new AIProviderError('GENERATION_FAILED'))
			.mockResolvedValueOnce({
				text: '# Structured',
				generationDurationMs: 4,
				inputLength: 100,
				outputLength: 12,
			})
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Structure notes' }))
		await user.click(await screen.findByRole('button', { name: 'Open' }))
		await user.click(await screen.findByRole('button', { name: 'Try Again' }))
		await user.click(await screen.findByRole('button', { name: 'Review' }))
		await screen.findByRole('button', { name: 'Apply' })

		expect(provider.generate).toHaveBeenCalledTimes(2)
		for (const [prompt] of vi.mocked(provider.generate).mock.calls) {
			expect(prompt).toContain('Organize the existing material')
		}
	})

	it('shows setup and generation as distinct states', async () => {
		const user = userEvent.setup()
		const setup = deferred<{ setupDurationMs: number }>()
		const provider = createProvider()
		provider.initialize = vi.fn().mockReturnValue(setup.promise)
		provider.generate = vi.fn().mockReturnValue(new Promise(() => undefined))
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		expect(screen.getByRole('status')).toHaveTextContent('Preparing local AI')

		setup.resolve({ setupDurationMs: 10 })
		await user.click(await screen.findByRole('button', { name: 'Improve writing' }))
		await user.click(screen.getByRole('button', { name: 'AI writing: working locally' }))
		expect(screen.getByRole('status')).toHaveTextContent('Working locally')
	})

	it('shows a minimal ready chooser with descriptive action titles and no Cancel action', async () => {
		const user = userEvent.setup()
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={createProvider()} />)

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))

		expect(screen.getByRole('heading', { name: 'AI writing' })).toBeInTheDocument()
		expect(screen.queryByText(/Experimental · Chrome built-in AI/)).not.toBeInTheDocument()
		expect(
			screen.queryByText(/suggestion will not change your document/i),
		).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Improve writing' })).toHaveAttribute(
			'title',
			expect.stringContaining('grammar'),
		)
		expect(screen.getByRole('button', { name: 'Structure notes' })).toHaveAttribute(
			'title',
			expect.stringContaining('headings'),
		)
		expect(screen.getByRole('button', { name: 'Summarize' })).toHaveAttribute(
			'title',
			expect.stringContaining('summary'),
		)
	})

	it('uses Close rather than a redundant Cancel in completed and outdated reviews', async () => {
		const user = userEvent.setup()
		const view = render(
			<AICleanup content="# Original" onApply={vi.fn()} provider={createProvider()} />,
		)

		await generateSuggestion(user)
		expect(screen.getByRole('button', { name: 'Close AI writing' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()

		view.rerender(
			<AICleanup content="# Changed" onApply={vi.fn()} provider={createProvider()} />,
		)
		expect(await screen.findByRole('button', { name: 'Regenerate' })).toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
	})

	it.each([
		['Improve writing', 'Improve grammar, clarity, and concision'],
		['Structure notes', 'Organize the existing material'],
		['Summarize', 'Produce a concise Markdown summary'],
	] as const)('runs the %s application-selected writing action', async (label, instruction) => {
		const user = userEvent.setup()
		const provider = createProvider()
		const onApply = vi.fn()
		render(<AICleanup content="# Source" onApply={onApply} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: label }))
		await user.click(await screen.findByRole('button', { name: 'Review' }))
		await user.click(await screen.findByRole('button', { name: 'Apply' }))

		const prompt = vi.mocked(provider.generate).mock.calls[0]?.[0]
		expect(prompt).toContain(instruction)
		expect(prompt).toContain(JSON.stringify({ markdown: '# Source' }))
		expect(onApply).toHaveBeenCalledWith('# Cleaned')
	})

	it('uses indeterminate preparation until genuine download progress arrives', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		let reportProgress: ((progress: number) => void) | undefined
		provider.initialize = vi.fn().mockImplementation((_prompt, options) => {
			reportProgress = options?.onDownloadProgress
			return new Promise(() => undefined)
		})
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		expect(screen.getByRole('status')).toHaveTextContent('Preparing local AI')
		const indeterminate = screen.getByRole('progressbar', {
			name: 'Local AI preparation in progress',
		})
		expect(indeterminate).not.toHaveAttribute('value')
		expect(indeterminate).not.toHaveAttribute('aria-valuenow')
		expect(indeterminate).toHaveClass('ai-progress__bar', 'ai-progress__bar--indeterminate')
		expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled()
		expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument()

		act(() => reportProgress?.(0))
		const zeroProgress = screen.getByRole('progressbar', {
			name: 'Local AI model download progress',
		})
		expect(zeroProgress).toHaveClass('ai-progress__bar', 'ai-progress__bar--determinate')
		expect(zeroProgress).toHaveAttribute('value', '0')
		expect(zeroProgress).toHaveAttribute('max', '100')
		expect(zeroProgress).toHaveAttribute('aria-valuemin', '0')
		expect(zeroProgress).toHaveAttribute('aria-valuemax', '100')
		expect(zeroProgress).toHaveAttribute('aria-valuenow', '0')
		expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled()
		expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument()
		act(() => reportProgress?.(0.375))
		expect(screen.getByRole('status')).toHaveTextContent('Downloading local AI model — 38%')
		const determinate = screen.getByRole('progressbar', {
			name: 'Local AI model download progress',
		})
		expect(determinate).toHaveAttribute('max', '100')
		expect(determinate).toHaveAttribute('value', '37.5')
	})

	it('transitions from genuine completed download progress to finalizing', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		let reportProgress: ((progress: number) => void) | undefined
		provider.initialize = vi.fn().mockImplementation((_prompt, options) => {
			reportProgress = options?.onDownloadProgress
			return new Promise(() => undefined)
		})
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		act(() => reportProgress?.(1))

		expect(screen.getByRole('status')).toHaveTextContent('Finalizing local AI session')
		expect(
			screen.getByRole('progressbar', { name: 'Local AI preparation in progress' }),
		).not.toHaveAttribute('value')
		expect(screen.queryByText(/100%/)).not.toBeInTheDocument()
	})

	it('does not manufacture 100% when setup completes without progress', async () => {
		const user = userEvent.setup()
		const setup = deferred<{ setupDurationMs: number }>()
		const provider = createProvider()
		provider.initialize = vi.fn().mockReturnValue(setup.promise)
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		expect(screen.queryByText(/%/)).not.toBeInTheDocument()
		setup.resolve({ setupDurationMs: 1 })
		expect(await screen.findByRole('button', { name: 'Improve writing' })).toBeInTheDocument()
		expect(screen.queryByText(/100%/)).not.toBeInTheDocument()
	})

	it('withholds partial output while Apply remains disabled until completion', async () => {
		const user = userEvent.setup()
		const generation = deferred<{
			text: string
			generationDurationMs: number
			inputLength: number
			outputLength: number
		}>()
		const provider = createProvider()
		provider.generate = vi.fn().mockReturnValue(generation.promise)
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Improve writing' }))
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'AI writing: working locally' }))
		expect(screen.getByRole('status')).toHaveTextContent('Working locally')
		expect(screen.queryByLabelText('AI suggestion')).not.toBeInTheDocument()
		expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()

		generation.resolve({
			text: '# Complete',
			generationDurationMs: 20,
			inputLength: 100,
			outputLength: 10,
		})
		await user.click(await screen.findByRole('button', { name: 'Review' }))
		expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled()
		expect(screen.getByLabelText('AI suggestion')).toHaveTextContent('# Complete')
	})

	it('aborts generation and keeps output hidden on Cancel', async () => {
		const user = userEvent.setup()
		const onApply = vi.fn()
		const provider = createProvider()
		let generationSignal: AbortSignal | undefined
		provider.generate = vi.fn().mockImplementation((_prompt, options) => {
			generationSignal = options?.signal
			return new Promise(() => undefined)
		})
		render(<AICleanup content="# Original" onApply={onApply} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Improve writing' }))
		await user.click(screen.getByRole('button', { name: 'AI writing: working locally' }))
		await user.click(screen.getByRole('button', { name: 'Cancel AI' }))

		expect(generationSignal?.aborted).toBe(true)
		expect(onApply).not.toHaveBeenCalled()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	})

	it('aborts model setup when the dialog is closed while preparing', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		let setupSignal: AbortSignal | undefined
		provider.initialize = vi.fn().mockImplementation((_systemPrompt, options) => {
			setupSignal = options?.signal
			return new Promise(() => undefined)
		})
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(screen.getByRole('button', { name: 'Close AI writing' }))

		expect(setupSignal?.aborted).toBe(true)
		expect(window.localStorage.getItem(AI_ENABLED_PREFERENCE_KEY)).toBeNull()
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
	})

	it('does not remember enablement when setup fails', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		provider.initialize = vi.fn().mockRejectedValue(new Error('private setup detail'))
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		expect(await screen.findByRole('alert')).toHaveTextContent('could not prepare')
		expect(window.localStorage.getItem(AI_ENABLED_PREFERENCE_KEY)).toBeNull()
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

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		expect(await screen.findByRole('alert')).toHaveTextContent(
			"Local AI couldn't become ready on this browser or device.",
		)
		expect(setupSignals[0]?.aborted).toBe(true)
		expect(window.localStorage.getItem(AI_ENABLED_PREFERENCE_KEY)).toBeNull()

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

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
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

	it('does not reset the setup watchdog for repeated or decreasing progress', async () => {
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
				setupWatchdogMs={100}
			/>,
		)

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		const enableButton = await screen.findByRole('button', { name: 'Enable AI' })
		vi.useFakeTimers()
		try {
			fireEvent.click(enableButton)
			act(() => reportProgress?.(0.5))
			act(() => vi.advanceTimersByTime(75))
			act(() => reportProgress?.(0.5))
			act(() => reportProgress?.(0.25))
			act(() => vi.advanceTimersByTime(26))
			expect(screen.getByRole('alert')).toHaveTextContent("couldn't become ready")
		} finally {
			vi.useRealTimers()
		}
	})

	it('resets visible progress for a fresh setup operation', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		const progressCallbacks: Array<(progress: number) => void> = []
		provider.initialize = vi.fn().mockImplementation((_systemPrompt, options) => {
			progressCallbacks.push(options.onDownloadProgress)
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

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		act(() => progressCallbacks[0]?.(0.6))
		expect(screen.getByRole('status')).toHaveTextContent('60%')
		expect(await screen.findByRole('alert')).toHaveTextContent("couldn't become ready")

		await user.click(screen.getByRole('button', { name: 'Try Again' }))
		expect(screen.getByRole('status')).toHaveTextContent('Preparing local AI')
		expect(screen.queryByText(/60%/)).not.toBeInTheDocument()
		act(() => progressCallbacks[0]?.(0.9))
		expect(screen.queryByText(/90%/)).not.toBeInTheDocument()
	})

	it('marks a review stale when the document changes and never revalidates it', async () => {
		const user = userEvent.setup()
		const onApply = vi.fn()
		const view = render(
			<AICleanup content="# Original" onApply={onApply} provider={createProvider()} />,
		)
		await generateSuggestion(user)

		view.rerender(
			<AICleanup content="# Changed" onApply={onApply} provider={createProvider()} />,
		)
		expect(await screen.findByRole('alert')).toHaveTextContent('document changed')
		expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Regenerate' })).toBeEnabled()

		view.rerender(
			<AICleanup content="# Original" onApply={onApply} provider={createProvider()} />,
		)
		expect(screen.getByRole('alert')).toHaveTextContent('document changed')
		expect(onApply).not.toHaveBeenCalled()
	})

	it('continues generation when content changes and regenerates from current content', async () => {
		const user = userEvent.setup()
		const first = deferred<AIGenerationResult>()
		const provider = createProvider()
		let firstSignal: AbortSignal | undefined
		const generate = vi.fn()
		generate.mockImplementationOnce((_prompt, options) => {
			firstSignal = options?.signal
			return first.promise
		})
		generate.mockResolvedValueOnce({
			text: '# Current clean',
			generationDurationMs: 1,
			inputLength: 10,
			outputLength: 15,
		})
		provider.generate = generate
		const view = render(
			<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />,
		)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Summarize' }))

		view.rerender(<AICleanup content="# Current" onApply={vi.fn()} provider={provider} />)
		expect(
			await screen.findByRole('button', { name: 'AI writing: result will be outdated' }),
		).toBeInTheDocument()
		expect(firstSignal?.aborted).toBe(false)
		first.resolve({
			text: '# Outdated summary',
			generationDurationMs: 1,
			inputLength: 10,
			outputLength: 18,
		})
		await user.click(await screen.findByRole('button', { name: 'Review' }))
		expect(screen.getByRole('alert')).toHaveTextContent('document changed')
		await user.click(screen.getByRole('button', { name: 'Regenerate' }))
		await waitFor(() => expect(provider.generate).toHaveBeenCalledTimes(2))
		expect(provider.generate).toHaveBeenLastCalledWith(
			expect.stringContaining(JSON.stringify({ markdown: '# Current' })),
			expect.any(Object),
		)
		for (const [prompt] of vi.mocked(provider.generate).mock.calls) {
			expect(prompt).toContain('Produce a concise Markdown summary')
		}
	})

	it('shows an explanation and disables regeneration when current content is whitespace', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		const view = render(
			<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />,
		)
		await generateSuggestion(user)
		await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled())
		view.rerender(<AICleanup content={' \n '} onApply={vi.fn()} provider={provider} />)

		expect(screen.getByRole('button', { name: 'AI writing: review outdated' })).toBeEnabled()
		expect(await screen.findByText('Add Markdown before regenerating.')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Regenerate' })).toBeDisabled()
	})

	it('re-enters normal setup after session expiry and controls recovery failures', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		provider.generate = vi.fn().mockRejectedValue(new AIProviderError('SESSION_EXPIRED'))
		provider.initialize = vi
			.fn()
			.mockResolvedValueOnce({ setupDurationMs: 1 })
			.mockRejectedValueOnce(new Error('private recovery detail'))
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)

		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Improve writing' }))
		await user.click(await screen.findByRole('button', { name: 'Open' }))
		expect(await screen.findByRole('alert')).toHaveTextContent('session expired')
		await user.click(screen.getByRole('button', { name: 'Try Again' }))
		expect(await screen.findByRole('alert')).toHaveTextContent('Chrome could not prepare')
		expect(screen.getByRole('alert')).not.toHaveTextContent('private recovery detail')
		expect(provider.initialize).toHaveBeenCalledTimes(2)
	})

	it('recovery setup uses the inactivity watchdog', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		provider.generate = vi.fn().mockRejectedValue(new AIProviderError('SESSION_EXPIRED'))
		provider.initialize = vi
			.fn()
			.mockResolvedValueOnce({ setupDurationMs: 1 })
			.mockReturnValueOnce(new Promise(() => undefined))
		render(
			<AICleanup
				content="# Original"
				onApply={vi.fn()}
				provider={provider}
				setupWatchdogMs={20}
			/>,
		)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Improve writing' }))
		await user.click(await screen.findByRole('button', { name: 'Open' }))
		await user.click(await screen.findByRole('button', { name: 'Try Again' }))
		expect(await screen.findByRole('alert')).toHaveTextContent("couldn't become ready")
	})

	it('ignores late setup progress and stream updates after cancellation', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		let progress: ((value: number) => void) | undefined
		const setup = deferred<{ setupDurationMs: number }>()
		provider.initialize = vi.fn().mockImplementation((_prompt, options) => {
			progress = options?.onDownloadProgress
			return setup.promise
		})
		const view = render(
			<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />,
		)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(screen.getByRole('button', { name: 'Close AI writing' }))
		act(() => progress?.(0.5))
		setup.resolve({ setupDurationMs: 1 })
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

		view.unmount()
		act(() => progress?.(0.8))
	})

	it('ignores late generation completion after cancellation and unmount', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		const generation = deferred<AIGenerationResult>()
		provider.generate = vi.fn().mockReturnValue(generation.promise)
		const view = render(
			<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />,
		)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Improve writing' }))
		await user.click(screen.getByRole('button', { name: 'AI writing: working locally' }))
		await user.click(screen.getByRole('button', { name: 'Cancel AI' }))
		generation.resolve({
			text: '# Late',
			generationDurationMs: 1,
			inputLength: 1,
			outputLength: 6,
		})
		expect(screen.queryByText('# Late')).not.toBeInTheDocument()
		view.unmount()
	})

	it('traps focus, makes the app inert, closes on Escape, and restores focus', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		render(
			<div className="app-shell">
				<button type="button">Outside</button>
				<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />
			</div>,
		)
		const trigger = screen.getByRole('button', { name: 'AI writing' })
		await user.click(trigger)
		const app = trigger.closest('.app-shell') as HTMLElement
		expect(app.inert).toBe(true)
		const close = await screen.findByRole('button', { name: 'Close AI writing' })
		expect(close).toHaveFocus()

		await user.tab({ shift: true })
		expect(screen.getByRole('button', { name: 'Enable AI' })).toHaveFocus()
		await user.tab()
		expect(close).toHaveFocus()
		const outside = screen.getByRole('button', { name: 'Outside' })
		outside.focus()
		expect(close).toHaveFocus()
		fireEvent.keyDown(document, { key: 'Escape' })
		expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
		expect(app.inert).toBe(false)
		expect(trigger).toHaveFocus()
	})

	it('guards repeated setup and Apply actions', async () => {
		const user = userEvent.setup()
		const onApply = vi.fn()
		const provider = createProvider()
		const setup = deferred<{ setupDurationMs: number }>()
		provider.initialize = vi.fn().mockReturnValue(setup.promise)
		render(<AICleanup content="# Original" onApply={onApply} provider={provider} />)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		const enableButton = await screen.findByRole('button', { name: 'Enable AI' })
		fireEvent.click(enableButton)
		fireEvent.click(enableButton)
		expect(provider.initialize).toHaveBeenCalledOnce()
		setup.resolve({ setupDurationMs: 1 })
		await user.click(await screen.findByRole('button', { name: 'Improve writing' }))
		await user.click(await screen.findByRole('button', { name: 'Review' }))
		const applyButton = await screen.findByRole('button', { name: 'Apply' })
		fireEvent.click(applyButton)
		fireEvent.click(applyButton)
		expect(onApply).toHaveBeenCalledOnce()
	})

	it('distinguishes a failed capability check from unsupported and allows retry', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		provider.getAvailability = vi
			.fn()
			.mockRejectedValueOnce(new AIProviderError('AVAILABILITY_CHECK_FAILED'))
			.mockResolvedValueOnce('available')
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		expect(await screen.findByRole('alert')).toHaveTextContent('could not be checked')
		expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'Retry' }))
		expect(await screen.findByRole('button', { name: 'Enable AI' })).toBeInTheDocument()
		expect(provider.getAvailability).toHaveBeenCalledTimes(2)
	})

	it.each([
		['INPUT_TOO_LARGE', 'too large'],
		['CONTEXT_MEASUREMENT_UNAVAILABLE', 'cannot safely measure'],
		['EMPTY_OUTPUT', 'no usable Markdown'],
	] as const)('maps %s to controlled content-free UI text', async (code, message) => {
		const user = userEvent.setup()
		const provider = createProvider()
		provider.generate = vi.fn().mockRejectedValue(new AIProviderError(code))
		render(<AICleanup content="# SECRET" onApply={vi.fn()} provider={provider} />)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Improve writing' }))
		await user.click(await screen.findByRole('button', { name: 'Open' }))
		const alert = await screen.findByRole('alert')
		expect(alert).toHaveTextContent(message)
		expect(alert).not.toHaveTextContent('SECRET')
	})

	it('unmount invalidates setup and prevents late callbacks from recreating timers', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		let progress: ((value: number) => void) | undefined
		provider.initialize = vi.fn().mockImplementation((_prompt, options) => {
			progress = options?.onDownloadProgress
			return new Promise(() => undefined)
		})
		const view = render(
			<AICleanup
				content="# Original"
				onApply={vi.fn()}
				provider={provider}
				setupWatchdogMs={40_000}
			/>,
		)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		vi.useFakeTimers()
		try {
			view.unmount()
			const timerCount = vi.getTimerCount()
			act(() => progress?.(0.5))
			expect(vi.getTimerCount()).toBe(timerCount)
			expect(provider.dispose).toHaveBeenCalledOnce()
		} finally {
			vi.useRealTimers()
		}
	})

	it('restores a pre-existing inert background state', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		const view = render(
			<div className="app-shell" inert>
				<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />
			</div>,
		)
		const trigger = screen.getByRole('button', { name: 'AI writing' })
		await user.click(trigger)
		await user.click(await screen.findByRole('button', { name: 'Close AI writing' }))
		expect(trigger.closest<HTMLElement>('.app-shell')?.inert).toBe(true)
		view.unmount()
	})

	it.each(['Improve writing', 'Structure notes', 'Summarize'])(
		'starts %s in the background and restores application focus',
		async (label) => {
			const user = userEvent.setup()
			const generation = deferred<AIGenerationResult>()
			const provider = createProvider()
			provider.generate = vi.fn().mockReturnValue(generation.promise)
			render(
				<div className="app-shell">
					<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />
				</div>,
			)
			await user.click(screen.getByRole('button', { name: 'AI writing' }))
			await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
			const action = await screen.findByRole('button', { name: label })
			fireEvent.click(action)
			fireEvent.click(action)

			expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
			expect(document.querySelector('.app-shell')).not.toHaveAttribute('inert')
			const workingTrigger = screen.getByRole('button', {
				name: 'AI writing: working locally',
			})
			expect(workingTrigger).toHaveFocus()
			expect(workingTrigger).toHaveAttribute('title', 'AI writing: working locally')
			expect(provider.generate).toHaveBeenCalledOnce()
		},
	)

	it('notifies without stealing focus and dismissal preserves toolbar review access', async () => {
		const user = userEvent.setup()
		const generation = deferred<AIGenerationResult>()
		const provider = createProvider()
		provider.generate = vi.fn().mockReturnValue(generation.promise)
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Improve writing' }))
		const trigger = screen.getByRole('button', { name: 'AI writing: working locally' })
		trigger.focus()
		generation.resolve({
			text: '# Complete',
			generationDurationMs: 1,
			inputLength: 10,
			outputLength: 10,
		})

		expect(await screen.findByText('AI review ready')).toBeInTheDocument()
		expect(trigger).toHaveFocus()
		expect(screen.getByRole('button', { name: 'AI writing: review ready' })).toHaveAttribute(
			'title',
			'AI writing: review ready',
		)
		await user.click(screen.getByRole('button', { name: 'Dismiss' }))
		expect(screen.queryByText('AI review ready')).not.toBeInTheDocument()
		await user.click(screen.getByRole('button', { name: 'AI writing: review ready' }))
		expect(await screen.findByLabelText('AI suggestion')).toHaveTextContent('# Complete')
	})

	it('keeps a background result irreversibly outdated and reviewable', async () => {
		const user = userEvent.setup()
		const generation = deferred<AIGenerationResult>()
		const provider = createProvider()
		provider.generate = vi.fn().mockReturnValue(generation.promise)
		const view = render(
			<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />,
		)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Summarize' }))
		view.rerender(<AICleanup content="# Changed" onApply={vi.fn()} provider={provider} />)
		view.rerender(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)
		generation.resolve({
			text: '# Old result',
			generationDurationMs: 1,
			inputLength: 10,
			outputLength: 12,
		})

		expect(await screen.findByText('AI review is outdated')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'AI writing: review outdated' })).toHaveAttribute(
			'title',
			'AI writing: review outdated',
		)
		await user.click(screen.getByRole('button', { name: 'Review' }))
		expect(screen.getByLabelText('AI suggestion')).toHaveTextContent('# Old result')
		expect(screen.queryByRole('button', { name: 'Apply' })).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Regenerate' })).toBeEnabled()
	})

	it('continues through ordinary closure and aborts only through Cancel AI', async () => {
		const user = userEvent.setup()
		const provider = createProvider()
		let signal: AbortSignal | undefined
		provider.generate = vi.fn().mockImplementation((_prompt, options) => {
			signal = options?.signal
			return new Promise(() => undefined)
		})
		render(<AICleanup content="# Original" onApply={vi.fn()} provider={provider} />)
		await user.click(screen.getByRole('button', { name: 'AI writing' }))
		await user.click(await screen.findByRole('button', { name: 'Enable AI' }))
		await user.click(await screen.findByRole('button', { name: 'Improve writing' }))
		await user.click(screen.getByRole('button', { name: 'AI writing: working locally' }))
		fireEvent.keyDown(document, { key: 'Escape' })
		expect(signal?.aborted).toBe(false)
		await user.click(screen.getByRole('button', { name: 'AI writing: working locally' }))
		await user.click(screen.getByRole('button', { name: 'Close AI writing' }))
		expect(signal?.aborted).toBe(false)
		await user.click(screen.getByRole('button', { name: 'AI writing: working locally' }))
		const backdrop = document.querySelector('.ai-review-backdrop')
		if (!backdrop) throw new Error('Expected AI backdrop')
		fireEvent.mouseDown(backdrop)
		expect(signal?.aborted).toBe(false)
		await user.click(screen.getByRole('button', { name: 'AI writing: working locally' }))
		await user.click(screen.getByRole('button', { name: 'Continue in background' }))
		expect(signal?.aborted).toBe(false)
		await user.click(screen.getByRole('button', { name: 'AI writing: working locally' }))
		await user.click(screen.getByRole('button', { name: 'Cancel AI' }))
		expect(signal?.aborted).toBe(true)
		expect(screen.getByRole('button', { name: 'AI writing' })).toBeInTheDocument()
	})
})
