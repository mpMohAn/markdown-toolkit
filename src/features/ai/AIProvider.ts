export type AIAvailability =
	'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available'

export type AIProviderErrorCode =
	| 'UNSUPPORTED'
	| 'UNAVAILABLE'
	| 'AVAILABILITY_CHECK_FAILED'
	| 'SESSION_EXPIRED'
	| 'SETUP_STALLED'
	| 'OPERATION_CANCELLED'
	| 'INPUT_TOO_LARGE'
	| 'CONTEXT_MEASUREMENT_UNAVAILABLE'
	| 'EMPTY_OUTPUT'
	| 'GENERATION_FAILED'

export class AIProviderError extends Error {
	readonly code: AIProviderErrorCode

	constructor(code: AIProviderErrorCode) {
		super(code)
		this.name = 'AIProviderError'
		this.code = code
	}
}

export function isAIProviderError(error: unknown): error is AIProviderError {
	return error instanceof AIProviderError
}

export interface AISetupOptions {
	signal?: AbortSignal
	onDownloadProgress?: (progress: number) => void
}

export interface AISetupResult {
	setupDurationMs: number
	contextUsage?: number
	contextWindow?: number
}

export interface AIGenerationOptions {
	signal?: AbortSignal
	onUpdate?: (text: string) => void
}

export interface AIGenerationResult {
	text: string
	generationDurationMs: number
	inputLength: number
	outputLength: number
	contextUsage?: number
	contextWindow?: number
}

export interface AIProvider {
	getAvailability(): Promise<AIAvailability>
	initialize(systemPrompt: string, options?: AISetupOptions): Promise<AISetupResult>
	generate(prompt: string, options?: AIGenerationOptions): Promise<AIGenerationResult>
	dispose(): void
}
