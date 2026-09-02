export type AIAvailability =
	'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available'

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

export class AIDocumentTooLargeError extends Error {
	constructor() {
		super('This document is too large for the local AI model in this POC.')
		this.name = 'AIDocumentTooLargeError'
	}
}
