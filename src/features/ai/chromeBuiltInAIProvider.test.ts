import { describe, expect, it, vi } from 'vitest'
import { ChromeBuiltInAIProvider } from './chromeBuiltInAIProvider'

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
	availability?: 'unavailable' | 'downloadable' | 'downloading' | 'available'
	createError?: Error
	streamError?: Error
	chunks?: string[]
}) {
	const baseDestroy = vi.fn()
	const taskSessions: Array<{
		promptStreaming: ReturnType<typeof vi.fn>
		destroy: ReturnType<typeof vi.fn>
	}> = []
	const clone = vi.fn().mockImplementation(() => {
		const task = {
			contextUsage: 120,
			contextWindow: 4096,
			measureContextUsage: vi.fn().mockResolvedValue(100),
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

	return {
		environment: {
			LanguageModel: {
				availability: vi.fn().mockResolvedValue(options?.availability ?? 'available'),
				create,
			},
		},
		create,
		clone,
		baseDestroy,
		taskSessions,
	}
}

describe('ChromeBuiltInAIProvider', () => {
	it('reports an unsupported environment without touching a model', async () => {
		const provider = new ChromeBuiltInAIProvider({})
		await expect(provider.getAvailability()).resolves.toBe('unsupported')
	})

	it.each(['available', 'downloadable'] as const)('reports the %s state', async (state) => {
		const fake = createEnvironment({ availability: state })
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		await expect(provider.getAvailability()).resolves.toBe(state)
	})

	it('surfaces model creation failures', async () => {
		const provider = new ChromeBuiltInAIProvider(
			createEnvironment({ createError: new Error('setup failed') }).environment,
		)
		await expect(provider.initialize('system')).rejects.toThrow('setup failed')
	})

	it('streams cumulative updates assembled from delta chunks', async () => {
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

	it('reuses one base session while cloning clean task contexts for later requests', async () => {
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

	it('surfaces streaming failures without destroying the reusable base session', async () => {
		const fake = createEnvironment({ streamError: new Error('stream failed') })
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		await provider.initialize('system')

		await expect(provider.generate('request')).rejects.toThrow('stream failed')
		expect(fake.taskSessions[0]?.destroy).toHaveBeenCalledOnce()
		expect(fake.baseDestroy).not.toHaveBeenCalled()
	})

	it('passes AbortSignal to a streamed task', async () => {
		const fake = createEnvironment()
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		const controller = new AbortController()
		await provider.initialize('system')
		await provider.generate('request', { signal: controller.signal })

		expect(fake.clone).toHaveBeenCalledWith({ signal: controller.signal })
		expect(fake.taskSessions[0]?.promptStreaming).toHaveBeenCalledWith('request', {
			signal: controller.signal,
		})
	})

	it('keeps the reusable session until provider teardown', async () => {
		const fake = createEnvironment()
		const provider = new ChromeBuiltInAIProvider(fake.environment)
		await provider.initialize('system')
		await provider.generate('request')
		provider.dispose()

		expect(fake.baseDestroy).toHaveBeenCalledOnce()
	})
})
