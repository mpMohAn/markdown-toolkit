import type {
	AIGenerationOptions,
	AIGenerationResult,
	AIAvailability,
	AIProvider,
	AISetupOptions,
	AISetupResult,
} from './AIProvider'
import { AIProviderError, isAIProviderError } from './AIProvider'

interface ChromeLanguageModelSession {
	readonly contextUsage: number
	readonly contextWindow: number
	promptStreaming(input: string, options?: { signal?: AbortSignal }): ReadableStream<string>
	measureContextUsage?(input: string): Promise<number>
	clone(options?: { signal?: AbortSignal }): Promise<ChromeLanguageModelSession>
	destroy(): void
}

interface DownloadProgressEvent {
	readonly loaded: number
}

interface LanguageModelCreateMonitor {
	addEventListener(
		type: 'downloadprogress',
		listener: (event: DownloadProgressEvent) => void,
	): void
	removeEventListener?(
		type: 'downloadprogress',
		listener: (event: DownloadProgressEvent) => void,
	): void
}

interface LanguageModelOptions {
	expectedInputs: ReadonlyArray<{ type: 'text'; languages: ReadonlyArray<string> }>
	expectedOutputs: ReadonlyArray<{ type: 'text'; languages: ReadonlyArray<string> }>
}

interface ChromeLanguageModelFactory {
	availability(options: LanguageModelOptions): Promise<unknown>
	create(
		options: LanguageModelOptions & {
			initialPrompts: ReadonlyArray<{ role: 'system'; content: string }>
			monitor?: (monitor: LanguageModelCreateMonitor) => void
			signal?: AbortSignal
		},
	): Promise<ChromeLanguageModelSession>
}

const LANGUAGE_MODEL_OPTIONS: LanguageModelOptions = {
	expectedInputs: [{ type: 'text', languages: ['en'] }],
	expectedOutputs: [{ type: 'text', languages: ['en'] }],
}

export class ChromeBuiltInAIProvider implements AIProvider {
	private readonly factory: ChromeLanguageModelFactory | null
	private baseSession: ChromeLanguageModelSession | null = null
	private sessionPromise: Promise<ChromeLanguageModelSession> | null = null
	private readonly activeTaskSessions = new Set<ChromeLanguageModelSession>()
	private readonly activeControllers = new Set<AbortController>()
	private readonly destroyedSessions = new WeakSet<ChromeLanguageModelSession>()
	private lifecycleVersion = 0

	constructor(environment: unknown = globalThis) {
		this.factory = readLanguageModelFactory(environment)
	}

	async getAvailability(): Promise<AIAvailability> {
		if (!this.factory) return 'unsupported'
		try {
			return normalizeAvailability(await this.factory.availability(LANGUAGE_MODEL_OPTIONS))
		} catch {
			throw new AIProviderError('AVAILABILITY_CHECK_FAILED')
		}
	}

	async initialize(systemPrompt: string, options: AISetupOptions = {}): Promise<AISetupResult> {
		if (!this.factory) throw new AIProviderError('UNSUPPORTED')
		if (this.baseSession) return this.sessionMetrics(0)
		if (this.sessionPromise) throw new AIProviderError('GENERATION_FAILED')

		const startedAt = performance.now()
		const lifecycleVersion = this.lifecycleVersion
		const operation = this.createOperation(options.signal)
		const progressListenerCleanup: { current: (() => void) | null } = { current: null }
		let latestDownloadProgress: number | null = null
		const creation = this.factory.create({
			...LANGUAGE_MODEL_OPTIONS,
			initialPrompts: [{ role: 'system', content: systemPrompt }],
			signal: operation.controller.signal,
			monitor: options.onDownloadProgress
				? (monitor) => {
						const listener = (event: DownloadProgressEvent) => {
							const progress = normalizeDownloadProgress(event)
							if (
								progress !== null &&
								(latestDownloadProgress === null ||
									progress > latestDownloadProgress) &&
								!operation.controller.signal.aborted &&
								lifecycleVersion === this.lifecycleVersion
							) {
								latestDownloadProgress = progress
								options.onDownloadProgress?.(progress)
							}
						}
						monitor.addEventListener('downloadprogress', listener)
						progressListenerCleanup.current = () =>
							monitor.removeEventListener?.('downloadprogress', listener)
					}
				: undefined,
		})
		this.sessionPromise = creation
		operation.controller.signal.addEventListener(
			'abort',
			() => {
				if (this.sessionPromise === creation) this.sessionPromise = null
			},
			{ once: true },
		)

		try {
			const session = await creation
			if (operation.controller.signal.aborted || lifecycleVersion !== this.lifecycleVersion) {
				this.safeDestroy(session)
				throw new AIProviderError('OPERATION_CANCELLED')
			}
			this.baseSession = session
			return this.sessionMetrics(performance.now() - startedAt)
		} catch (error) {
			throw mapProviderError(error)
		} finally {
			progressListenerCleanup.current?.()
			if (this.sessionPromise === creation) this.sessionPromise = null
			operation.release()
		}
	}

	async generate(prompt: string, options: AIGenerationOptions = {}): Promise<AIGenerationResult> {
		if (!this.baseSession) throw new AIProviderError('SESSION_EXPIRED')
		const startedAt = performance.now()
		const lifecycleVersion = this.lifecycleVersion
		const operation = this.createOperation(options.signal)
		let taskSession: ChromeLanguageModelSession | null = null

		try {
			taskSession = await this.cloneTaskSession(operation.controller.signal)
			if (operation.controller.signal.aborted || lifecycleVersion !== this.lifecycleVersion) {
				throw new AIProviderError('OPERATION_CANCELLED')
			}
			this.activeTaskSessions.add(taskSession)

			if (typeof taskSession.measureContextUsage !== 'function') {
				throw new AIProviderError('CONTEXT_MEASUREMENT_UNAVAILABLE')
			}
			let requiredContext: number
			try {
				requiredContext = await taskSession.measureContextUsage(prompt)
			} catch (error) {
				if (isAbortError(error)) throw error
				if (isQuotaExceededError(error)) throw new AIProviderError('INPUT_TOO_LARGE')
				if (isUnusableSessionError(error)) throw new AIProviderError('SESSION_EXPIRED')
				throw new AIProviderError('CONTEXT_MEASUREMENT_UNAVAILABLE')
			}
			if (!Number.isFinite(requiredContext) || requiredContext < 0) {
				throw new AIProviderError('CONTEXT_MEASUREMENT_UNAVAILABLE')
			}
			if (operation.controller.signal.aborted || lifecycleVersion !== this.lifecycleVersion) {
				throw new AIProviderError('OPERATION_CANCELLED')
			}
			if (
				!Number.isFinite(taskSession.contextUsage) ||
				!Number.isFinite(taskSession.contextWindow) ||
				taskSession.contextUsage < 0 ||
				taskSession.contextWindow <= 0
			) {
				throw new AIProviderError('CONTEXT_MEASUREMENT_UNAVAILABLE')
			}
			if (taskSession.contextUsage + requiredContext > taskSession.contextWindow) {
				throw new AIProviderError('INPUT_TOO_LARGE')
			}

			let text = ''
			const stream = taskSession.promptStreaming(prompt, {
				signal: operation.controller.signal,
			})
			for await (const chunk of stream) {
				if (
					operation.controller.signal.aborted ||
					lifecycleVersion !== this.lifecycleVersion
				) {
					throw new AIProviderError('OPERATION_CANCELLED')
				}
				text += chunk
				options.onUpdate?.(text)
			}
			if (operation.controller.signal.aborted || lifecycleVersion !== this.lifecycleVersion) {
				throw new AIProviderError('OPERATION_CANCELLED')
			}
			if (!text.trim()) throw new AIProviderError('EMPTY_OUTPUT')

			return {
				text,
				generationDurationMs: performance.now() - startedAt,
				inputLength: prompt.length,
				outputLength: text.length,
				contextUsage: taskSession.contextUsage,
				contextWindow: taskSession.contextWindow,
			}
		} catch (error) {
			const mapped = mapProviderError(error)
			if (mapped.code === 'SESSION_EXPIRED') this.clearBaseSession()
			throw mapped
		} finally {
			if (taskSession) {
				this.activeTaskSessions.delete(taskSession)
				this.safeDestroy(taskSession)
			}
			operation.release()
		}
	}

	dispose(): void {
		this.lifecycleVersion += 1
		for (const controller of this.activeControllers) controller.abort()
		this.activeControllers.clear()
		this.sessionPromise = null
		for (const taskSession of this.activeTaskSessions) this.safeDestroy(taskSession)
		this.activeTaskSessions.clear()
		this.clearBaseSession()
	}

	private async cloneTaskSession(signal: AbortSignal): Promise<ChromeLanguageModelSession> {
		if (!this.baseSession) throw new AIProviderError('SESSION_EXPIRED')
		try {
			return await this.baseSession.clone({ signal })
		} catch (error) {
			if (isUnusableSessionError(error)) {
				this.clearBaseSession()
				throw new AIProviderError('SESSION_EXPIRED')
			}
			throw error
		}
	}

	private createOperation(externalSignal?: AbortSignal) {
		const controller = new AbortController()
		this.activeControllers.add(controller)
		const abort = () => controller.abort()
		if (externalSignal?.aborted) controller.abort()
		else externalSignal?.addEventListener('abort', abort, { once: true })

		return {
			controller,
			release: () => {
				externalSignal?.removeEventListener('abort', abort)
				this.activeControllers.delete(controller)
			},
		}
	}

	private clearBaseSession() {
		if (this.baseSession) this.safeDestroy(this.baseSession)
		this.baseSession = null
	}

	private safeDestroy(session: ChromeLanguageModelSession) {
		if (this.destroyedSessions.has(session)) return
		this.destroyedSessions.add(session)
		try {
			session.destroy()
		} catch {
			// Destruction is best-effort and must remain idempotent at the provider boundary.
		}
	}

	private sessionMetrics(setupDurationMs: number): AISetupResult {
		return {
			setupDurationMs,
			contextUsage: this.baseSession?.contextUsage,
			contextWindow: this.baseSession?.contextWindow,
		}
	}
}

function readLanguageModelFactory(environment: unknown): ChromeLanguageModelFactory | null {
	if ((typeof environment !== 'object' && typeof environment !== 'function') || !environment) {
		return null
	}
	const languageModel = Reflect.get(environment, 'LanguageModel')
	if (
		(typeof languageModel !== 'object' && typeof languageModel !== 'function') ||
		!languageModel ||
		typeof Reflect.get(languageModel, 'availability') !== 'function' ||
		typeof Reflect.get(languageModel, 'create') !== 'function'
	) {
		return null
	}
	return languageModel as ChromeLanguageModelFactory
}

function normalizeAvailability(value: unknown): AIAvailability {
	return value === 'unavailable' ||
		value === 'downloadable' ||
		value === 'downloading' ||
		value === 'available'
		? value
		: 'unsupported'
}

export function normalizeDownloadProgress(event: unknown): number | null {
	if ((typeof event !== 'object' && typeof event !== 'function') || !event) return null
	const loaded = Reflect.get(event, 'loaded')
	if (typeof loaded !== 'number' || !Number.isFinite(loaded) || loaded < 0) return null
	return Math.min(1, loaded)
}

function mapProviderError(error: unknown): AIProviderError {
	if (isAIProviderError(error)) return error
	if (isAbortError(error)) return new AIProviderError('OPERATION_CANCELLED')
	if (isQuotaExceededError(error)) return new AIProviderError('INPUT_TOO_LARGE')
	if (isUnusableSessionError(error)) return new AIProviderError('SESSION_EXPIRED')
	return new AIProviderError('GENERATION_FAILED')
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError'
}

function isQuotaExceededError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'QuotaExceededError'
}

function isUnusableSessionError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'InvalidStateError'
}
