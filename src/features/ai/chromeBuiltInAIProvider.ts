import type {
	AIGenerationOptions,
	AIGenerationResult,
	AIAvailability,
	AIProvider,
	AISetupOptions,
	AISetupResult,
} from './AIProvider'
import { AIDocumentTooLargeError } from './AIProvider'

type ChromeAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

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
}

interface LanguageModelOptions {
	expectedInputs: ReadonlyArray<{ type: 'text'; languages: ReadonlyArray<string> }>
	expectedOutputs: ReadonlyArray<{ type: 'text'; languages: ReadonlyArray<string> }>
}

interface ChromeLanguageModelFactory {
	availability(options: LanguageModelOptions): Promise<ChromeAvailability>
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
	private systemPrompt: string | null = null
	private lifecycleVersion = 0
	private setupVersion = 0

	constructor(environment: unknown = globalThis) {
		this.factory = readLanguageModelFactory(environment)
	}

	async getAvailability(): Promise<AIAvailability> {
		if (!this.factory) return 'unsupported'
		return this.factory.availability(LANGUAGE_MODEL_OPTIONS)
	}

	async initialize(systemPrompt: string, options: AISetupOptions = {}): Promise<AISetupResult> {
		if (!this.factory) throw new Error('Chrome built-in AI is not available.')
		if (this.baseSession) return this.sessionMetrics(0)

		const startedAt = performance.now()
		const lifecycleVersion = this.lifecycleVersion
		this.systemPrompt = systemPrompt

		if (!this.sessionPromise) {
			const setupVersion = ++this.setupVersion
			const creation = this.factory.create({
				...LANGUAGE_MODEL_OPTIONS,
				initialPrompts: [{ role: 'system', content: systemPrompt }],
				signal: options.signal,
				monitor: options.onDownloadProgress
					? (monitor) => {
							monitor.addEventListener('downloadprogress', (event) => {
								options.onDownloadProgress?.(clampProgress(event.loaded))
							})
						}
					: undefined,
			})
			this.sessionPromise = creation
			options.signal?.addEventListener(
				'abort',
				() => {
					if (this.sessionPromise === creation) this.sessionPromise = null
					if (this.setupVersion === setupVersion) this.setupVersion += 1
				},
				{ once: true },
			)
		}

		const creation = this.sessionPromise
		const setupVersion = this.setupVersion
		try {
			const session = await creation
			if (lifecycleVersion !== this.lifecycleVersion || setupVersion !== this.setupVersion) {
				session.destroy()
				throw new DOMException('The local AI setup was aborted.', 'AbortError')
			}
			this.baseSession = session
			return this.sessionMetrics(performance.now() - startedAt)
		} finally {
			if (this.sessionPromise === creation) this.sessionPromise = null
		}
	}

	async generate(prompt: string, options: AIGenerationOptions = {}): Promise<AIGenerationResult> {
		const startedAt = performance.now()
		let taskSession: ChromeLanguageModelSession | null = null

		try {
			taskSession = await this.cloneTaskSession(options.signal)
			if (taskSession.measureContextUsage) {
				const requiredContext = await taskSession.measureContextUsage(prompt)
				if (taskSession.contextUsage + requiredContext > taskSession.contextWindow) {
					throw new AIDocumentTooLargeError()
				}
			}

			let text = ''
			const stream = taskSession.promptStreaming(prompt, { signal: options.signal })
			for await (const chunk of stream) {
				text += chunk
				options.onUpdate?.(text)
			}

			return {
				text,
				generationDurationMs: performance.now() - startedAt,
				inputLength: prompt.length,
				outputLength: text.length,
				contextUsage: taskSession.contextUsage,
				contextWindow: taskSession.contextWindow,
			}
		} catch (error) {
			if (isQuotaExceededError(error)) throw new AIDocumentTooLargeError()
			throw error
		} finally {
			taskSession?.destroy()
		}
	}

	dispose(): void {
		this.lifecycleVersion += 1
		this.setupVersion += 1
		this.sessionPromise = null
		this.baseSession?.destroy()
		this.baseSession = null
		this.systemPrompt = null
	}

	private async cloneTaskSession(signal?: AbortSignal): Promise<ChromeLanguageModelSession> {
		if (!this.baseSession) throw new Error('Local AI is not ready.')

		try {
			return await this.baseSession.clone({ signal })
		} catch (error) {
			if (!isUnusableSessionError(error) || !this.factory || !this.systemPrompt) throw error

			this.baseSession.destroy()
			this.baseSession = null
			await this.initialize(this.systemPrompt, { signal })
			return this.requireBaseSession().clone({ signal })
		}
	}

	private requireBaseSession(): ChromeLanguageModelSession {
		if (!this.baseSession) throw new Error('Local AI session recovery failed.')
		return this.baseSession
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
		!languageModel
	) {
		return null
	}

	if (
		typeof Reflect.get(languageModel, 'availability') !== 'function' ||
		typeof Reflect.get(languageModel, 'create') !== 'function'
	) {
		return null
	}

	return languageModel as ChromeLanguageModelFactory
}

function clampProgress(progress: number): number {
	return Math.min(1, Math.max(0, progress))
}

function isQuotaExceededError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'QuotaExceededError'
}

function isUnusableSessionError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'InvalidStateError'
}
