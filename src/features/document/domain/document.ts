export type DocumentId = string

export interface MarkdownDocument {
	id: DocumentId
	content: string
	createdAt: string
	updatedAt: string
}

export function createEmptyDocument(id: DocumentId, now: Date = new Date()): MarkdownDocument {
	const timestamp = now.toISOString()

	return {
		id,
		content: '',
		createdAt: timestamp,
		updatedAt: timestamp,
	}
}

export function isMarkdownDocument(value: unknown): value is MarkdownDocument {
	if (typeof value !== 'object' || value === null) {
		return false
	}

	const document = value as Record<string, unknown>

	return (
		typeof document.id === 'string' &&
		typeof document.content === 'string' &&
		isIsoTimestamp(document.createdAt) &&
		isIsoTimestamp(document.updatedAt)
	)
}

function isIsoTimestamp(value: unknown): value is string {
	return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}
