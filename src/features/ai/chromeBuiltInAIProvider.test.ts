import { describe, expect, it, vi } from 'vitest'
import { AIProviderError } from './AIProvider'
import { ChromeBuiltInAIProvider, normalizeDownloadProgress } from './chromeBuiltInAIProvider'

function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})
	return { promise, resolve, reject }
}

function streamChunks(chunks: string[], error?: Error): ReadableStream<string> {
	return new ReadableStream({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(chunk)
			if (error) controller.error(error)
			else controller.close()
		},
	})
}

function createEnvironment(options?: {
	availability?: unknown
	availabilityError?: Error
	createError?: Error
	cloneError?: Error
	streamError?: Error
	measureError?: Error
	measureValue?: number
	withoutMeasurement?: boolean
	chunks?: string[]
	contextUsage?: number
	contextWindow?: number
}) {
	const baseDestroy = vi.fn()
	const taskSessions: Array<{
		promptStreaming: ReturnType<typeof vi.fn>
		measureContextUsage?: ReturnType<typeof vi.fn>
		destroy: ReturnType<typeof vi.fn>
	}> = []
	const clone = options?.cloneError
		? vi.fn().mockRejectedValue(options.cloneError)
		: vi.fn().mockImplementation(() => {
				const task = {
					contextUsage: options?.contextUsage ?? 120,
					contextWindow: options?.contextWindow ?? 4096,
					measureContextUsage: options?.withoutMeasurement
						? undefined
						: options?.measureError
							? vi.fn().mockRejectedValue(options.measureError)
							: vi.fn().mockResolvedValue(options?.measureValue ?? 100),
					promptStreaming: vi
						.fn()
						.mockReturnValue(
							streamChunks(options?.chunks ?? ['# ', 'Clean'], options?.streamError),
						),
					destroy: vi.fn(),
				}
				taskSessions.push(task)
				return Promise.resolve(task)
			})
	const create = options?.createError
		? vi.fn().mockRejectedValue(options.createError)
		: vi.fn().mockResolvedValue({
				contextUsage: 20,
				contextWindow: 4096,
				clone,
				destroy: baseDestroy,
			})
	const availability = options?.availabilityError
		? vi.fn().mockRejectedValue(options.availabilityError)
		: vi.fn().mockResolvedValue(options?.availability ?? 'available')

	return {
		environment: { LanguageModel: { availability, create } },
		availability,
		create,
		clone,
		baseDestroy,
		taskSessions,
	}
}

async function expectCode(promise: Promise<unknown>, code: string) {
	await expect(promise).rejects.toMatchObject({ name: 'AIProviderError', code })
}

describe('ChromeBuiltInAIProvider', () => {
	it('normalizes only genuine normalized Chrome download progress', () => {
		expect(normalizeDownloadProgress({ loaded: 0 })).toBe(0)
		expect(normalizeDownloadProgress({ loaded: 0.42 })).toBe(0.42)
		expect(normalizeDownloadProgress({ loaded: 1 })).toBe(1)
		expect(normalizeDownloadProgress({ loaded: 1.5 })).toBe(1)
		for (const event of [
			{},
			{ loaded: '0.5' },
			{ loaded: Number.NaN },
			{ loaded: Number.POSITIVE_INFINITY },
			{ loaded: -0.1 },
			null,
		]) {
			expect(normalizeDownloadProgress(event)).toBeNull()
		}
	})

	it('forwards only strictly advancing genuine progress within one setup', async () => {
		let listener: ((event: { loaded: number }) => void) | undefined
		const onDownloadProgress = vi.fn()
		const fake = createEnvironment()
		fake.create.mockImplementationOnce((options) => {
			options.monitor?.({
				addEventListener: (
					_type: 'downloadprogress',
					nextListener: (event: { loaded: number }) => void,
				) => {
					listener = nextListener
				},
			})
			listener?.({ loaded: 0.4 })
			listener?.({ loaded: 0.4 })
			listener?.({ loaded: 0.2 })
			listener?.({ loaded: Number.NaN })
			listener?.({ loaded: 2 })
			return Promise.resolve({
				contextUsage: 20,
				contextWindow: 4096,
				clone: fake.clone,
				destroy: fake.baseDestroy,
			})
		})

		await new ChromeBuiltInAIProvider(fake.environment).initialize('system', {
			onDownloadProgress,
		})

		expect(onDownloadProgress.mock.calls).toEqual([[0.4], [1]])
	})

	it('reports an unsupported environment without touching a model', async () => {
		await expect(new ChromeBuiltInAIProvider({}).getAvailability()).resolves.toBe('unsupported')
	})

	it.each(['available', 'downloadable', 'downloading', 'unavailable'] as const)(
		'normalizes the supported %s state',
		async (availability) => {
			const fake = createEnvironment({ availability })
			await expect(
				new ChromeBuiltInAIProvider(fake.environment).getAvailability(),
			).resolves.toBe(availability)
		},
	)

	it('normalizes an unknown runtime availability value to unsupported', async () => {
		const fake = createEnvironment({ availability: 'sometimes-ready' })
		await expect(new ChromeBuiltInAIProvider(fake.environment).getAvailability()).resolves.toBe(
			'unsupported',
		)
	})

	it('uses a typed error when the capability check rejects', async () => {
		const fake = createEnvironment({ availabilityError: new Error('private browser detail') })
		await expectCode(
			new ChromeBuiltInAIProvider(fake.environment).getAvailability(),
			'AVAILABILITY_CHECK_FAILED',
		)
	})

	it('maps model creation failures without exposing the browser error', async () => {
		const provider = new ChromeBuiltInAIProvider(
			createEnvironment({ createError: new Error('private setup detail') }).environment,
		)
		await expectCode(provider.initialize('system'), 'GENERATION_FAILED')
	})

	it('detaches the model download progress listener after setup', async () => {
		const addEventListener = vi.fn()
		const removeEventListener = vi.fn()
		const session = {
			contextUsage: 0,
			contextWindow: 100,
			clone: vi.fn(),
			destroy: vi.fn(),
		}
		const environment = {
			LanguageModel: {
				availability: vi.fn().mockResolvedValue('downloadable'),
				create: vi.fn().mockImplementation((options) => {
					options.monitor?.({ addEventListener, removeEventListener })
					return Promise.resolve(session)
				}),
			},
		}
		const provider = new ChromeBuiltInAIProvider(environment)
		await provider.initialize('system', { onDownloadProgress: vi.fn() })

		expect(addEventListener).toHaveBeenCalledOnce()
		expect(removeEventListener).toHaveBeenCalledWith(
			'downloadprogress',
			addEventListener.mock.calls[0]?.[1],
		)
	})

	it('destroys a setup session that resolves after provider disposal', async () => {
		const setup = deferred<{
			contextUsage: number
			contextWindow: number
			clone: ReturnType<typeof vi.fn>
			destroy: ReturnType<typeof vi.fn>
		}>()
		const destroy = vi.fn()
		const fake = createEnvironment()
		fake.create.mockReturnValueOnce(setup.promise)
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		const result = provider.initialize('system').catch((error: unknown) => error)
		provider.dispose()
		setup.resolve({ contextUsage: 0, contextWindow: 100, clone: vi.fn(), destroy })

		await expect(result).resolves.toMatchObject({ code: 'OPERATION_CANCELLED' })
		expect(destroy).toHaveBeenCalledOnce()
	})

	it('allows a fresh controlled setup after the previous setup is aborted', async () => {
		const staleSetup = deferred<{
			contextUsage: number
			contextWindow: number
			clone: ReturnType<typeof vi.fn>
			destroy: ReturnType<typeof vi.fn>
		}>()
		const fake = createEnvironment()
		fake.create.mockReturnValueOnce(staleSetup.promise)
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		const controller = new AbortController()
		const staleResult = provider
			.initialize('system', { signal: controller.signal })
			.catch((error: unknown) => error)
		controller.abort()
		await expect(provider.initialize('system')).resolves.toMatchObject({
			setupDurationMs: expect.any(Number),
		})
		const staleDestroy = vi.fn()
		staleSetup.resolve({
			contextUsage: 0,
			contextWindow: 100,
			clone: vi.fn(),
			destroy: staleDestroy,
		})

		await expect(staleResult).resolves.toMatchObject({ code: 'OPERATION_CANCELLED' })
		expect(fake.create).toHaveBeenCalledTimes(2)
		expect(staleDestroy).toHaveBeenCalledOnce()
	})

	it('streams cumulative updates and destroys its clone', async () => {
		const fake = createEnvironment({ chunks: ['# ', 'Clean'] })
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		const onUpdate = vi.fn()
		await provider.initialize('system')

		const result = await provider.generate('request', { onUpdate })

		expect(result.text).toBe('# Clean')
		expect(onUpdate.mock.calls).toEqual([['# '], ['# Clean']])
		expect(fake.taskSessions[0]?.destroy).toHaveBeenCalledOnce()
		expect(fake.baseDestroy).not.toHaveBeenCalled()
	})

	it('reuses one base session while cloning isolated task contexts', async () => {
		const fake = createEnvironment()
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		await provider.initialize('cleanup system instructions')
		await provider.generate('first document')
		await provider.generate('second document')

		expect(fake.create).toHaveBeenCalledOnce()
		expect(fake.clone).toHaveBeenCalledTimes(2)
		expect(fake.taskSessions[0]?.promptStreaming).toHaveBeenCalledWith(
			'first document',
			expect.any(Object),
		)
		expect(fake.taskSessions[1]?.promptStreaming).toHaveBeenCalledWith(
			'second document',
			expect.any(Object),
		)
	})

	it('does not secretly recreate an expired base session', async () => {
		const fake = createEnvironment({
			cloneError: new DOMException('browser detail', 'InvalidStateError'),
		})
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		await provider.initialize('system')

		await expectCode(provider.generate('request'), 'SESSION_EXPIRED')
		expect(fake.create).toHaveBeenCalledOnce()
		expect(fake.baseDestroy).toHaveBeenCalledOnce()
	})

	it('destroys a clone that resolves after disposal during cloning', async () => {
		const cloneResult = deferred<{
			contextUsage: number
			contextWindow: number
			measureContextUsage: ReturnType<typeof vi.fn>
			promptStreaming: ReturnType<typeof vi.fn>
			destroy: ReturnType<typeof vi.fn>
		}>()
		const fake = createEnvironment()
		fake.clone.mockReturnValueOnce(cloneResult.promise)
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		await provider.initialize('system')
		const result = provider.generate('request').catch((error: unknown) => error)
		provider.dispose()
		const destroy = vi.fn()
		cloneResult.resolve({
			contextUsage: 0,
			contextWindow: 100,
			measureContextUsage: vi.fn().mockResolvedValue(1),
			promptStreaming: vi.fn(),
			destroy,
		})

		await expect(result).resolves.toMatchObject({ code: 'OPERATION_CANCELLED' })
		expect(destroy).toHaveBeenCalledOnce()
	})

	it('fails closed when context measurement is absent or rejects', async () => {
		const missing = createEnvironment({ withoutMeasurement: true })
		const missingProvider = new ChromeBuiltInAIProvider(missing.environment)
		await missingProvider.initialize('system')
		await expectCode(missingProvider.generate('request'), 'CONTEXT_MEASUREMENT_UNAVAILABLE')
		expect(missing.taskSessions[0]?.promptStreaming).not.toHaveBeenCalled()

		const rejected = createEnvironment({ measureError: new Error('measurement detail') })
		const rejectedProvider = new ChromeBuiltInAIProvider(rejected.environment)
		await rejectedProvider.initialize('system')
		await expectCode(rejectedProvider.generate('request'), 'CONTEXT_MEASUREMENT_UNAVAILABLE')
		expect(rejected.taskSessions[0]?.promptStreaming).not.toHaveBeenCalled()
	})

	it('treats InvalidStateError during context measurement as an expired session', async () => {
		const fake = createEnvironment({
			measureError: new DOMException('private detail', 'InvalidStateError'),
		})
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		await provider.initialize('system')
		await expectCode(provider.generate('request'), 'SESSION_EXPIRED')
		expect(fake.baseDestroy).toHaveBeenCalledOnce()
	})

	it('allows an exact context boundary and rejects one unit beyond it', async () => {
		const exact = createEnvironment({
			contextUsage: 120,
			contextWindow: 220,
			measureValue: 100,
		})
		const exactProvider = new ChromeBuiltInAIProvider(exact.environment)
		await exactProvider.initialize('system')
		await expect(exactProvider.generate('request')).resolves.toMatchObject({ text: '# Clean' })

		const over = createEnvironment({ contextUsage: 120, contextWindow: 219, measureValue: 100 })
		const overProvider = new ChromeBuiltInAIProvider(over.environment)
		await overProvider.initialize('system')
		await expectCode(overProvider.generate('request'), 'INPUT_TOO_LARGE')
		expect(over.taskSessions[0]?.promptStreaming).not.toHaveBeenCalled()
	})

	it('maps quota errors during measurement to input too large', async () => {
		const fake = createEnvironment({
			measureError: new DOMException('quota detail', 'QuotaExceededError'),
		})
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		await provider.initialize('system')
		await expectCode(provider.generate('request'), 'INPUT_TOO_LARGE')
	})

	it('destroys a clone after stream errors, cancellation, and empty output', async () => {
		for (const options of [
			{ streamError: new Error('stream detail') },
			{ chunks: [] as string[] },
		]) {
			const fake = createEnvironment(options)
			const provider = new ChromeBuiltInAIProvider(fake.environment)
			await provider.initialize('system')
			await expect(provider.generate('request')).rejects.toBeInstanceOf(AIProviderError)
			expect(fake.taskSessions[0]?.destroy).toHaveBeenCalledOnce()
		}

		const fake = createEnvironment()
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		const controller = new AbortController()
		await provider.initialize('system')
		controller.abort()
		await expectCode(
			provider.generate('request', { signal: controller.signal }),
			'OPERATION_CANCELLED',
		)
		expect(fake.taskSessions[0]?.destroy).toHaveBeenCalledOnce()
	})

	it('destroys active clones immediately on disposal and cleanup remains idempotent', async () => {
		const stream = deferred<ReadableStreamReadResult<string>>()
		const fake = createEnvironment()
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		await provider.initialize('system')
		fake.clone.mockImplementationOnce(async () => {
			const task = {
				contextUsage: 0,
				contextWindow: 100,
				measureContextUsage: vi.fn().mockResolvedValue(1),
				promptStreaming: vi.fn().mockReturnValue({
					[Symbol.asyncIterator]() {
						return { next: () => stream.promise }
					},
				}),
				destroy: vi.fn(),
			}
			fake.taskSessions.push(task)
			return task
		})

		const generation = provider.generate('request').catch((error: unknown) => error)
		await vi.waitFor(() => expect(fake.taskSessions[0]?.promptStreaming).toHaveBeenCalledOnce())
		provider.dispose()
		provider.dispose()
		expect(fake.taskSessions[0]?.destroy).toHaveBeenCalledOnce()
		expect(fake.baseDestroy).toHaveBeenCalledOnce()
		stream.resolve({ done: true, value: undefined })
		await expect(generation).resolves.toMatchObject({ code: 'OPERATION_CANCELLED' })
	})
})
