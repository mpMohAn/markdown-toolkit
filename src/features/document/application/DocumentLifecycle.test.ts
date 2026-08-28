import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DocumentRepository } from '../domain/DocumentRepository'
import type { DocumentId, MarkdownDocument } from '../domain/document'
import { AUTOSAVE_DELAY_MS, DocumentLifecycle } from './DocumentLifecycle'

describe('DocumentLifecycle', () => {
	afterEach(() => vi.useRealTimers())

	it('creates and persists an empty document on first visit', async () => {
		const repository = new MemoryDocumentRepository()
		const lifecycle = new DocumentLifecycle({ repository, now: fixedNow })

		await lifecycle.hydrate()

		expect(lifecycle.getState()).toMatchObject({
			status: 'saved',
			document: { id: 'active-document', content: '' },
		})
		expect(repository.savedDocuments).toHaveLength(1)
	})

	it('hydrates an existing document', async () => {
		const document = createDocument({ content: 'Persisted content' })
		const repository = new MemoryDocumentRepository([document])
		const lifecycle = new DocumentLifecycle({ repository })

		await lifecycle.hydrate()

		expect(lifecycle.getState()).toEqual({ status: 'ready', document, error: null })
	})

	it('marks edits dirty and autosaves after the debounce interval', async () => {
		vi.useFakeTimers()
		const repository = new MemoryDocumentRepository([createDocument()])
		const lifecycle = new DocumentLifecycle({ repository })
		await lifecycle.hydrate()

		lifecycle.updateContent('Edited')
		expect(lifecycle.getState().status).toBe('dirty')
		expect(repository.savedDocuments).toHaveLength(0)

		await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)

		expect(repository.savedDocuments).toHaveLength(1)
		expect(repository.savedDocuments[0]?.content).toBe('Edited')
		expect(lifecycle.getState().status).toBe('saved')
	})

	it('coalesces continuous editing into one autosave write', async () => {
		vi.useFakeTimers()
		const repository = new MemoryDocumentRepository([createDocument()])
		const lifecycle = new DocumentLifecycle({ repository })
		await lifecycle.hydrate()

		lifecycle.updateContent('First')
		await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)
		lifecycle.updateContent('Second')
		await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1)

		expect(repository.savedDocuments).toHaveLength(0)

		await vi.advanceTimersByTimeAsync(1)

		expect(repository.savedDocuments).toHaveLength(1)
		expect(repository.savedDocuments[0]?.content).toBe('Second')
	})

	it('does not report saved when persistence fails', async () => {
		vi.useFakeTimers()
		const repository = new MemoryDocumentRepository([createDocument()])
		repository.saveError = new Error('Storage quota exceeded')
		const lifecycle = new DocumentLifecycle({ repository })
		await lifecycle.hydrate()

		lifecycle.updateContent('Unsaved work')
		await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS)

		expect(lifecycle.getState()).toMatchObject({
			status: 'error',
			document: { content: 'Unsaved work' },
			error: 'Storage quota exceeded',
		})
	})
})

class MemoryDocumentRepository implements DocumentRepository {
	readonly savedDocuments: MarkdownDocument[] = []
	saveError: Error | undefined
	private readonly documents = new Map<DocumentId, MarkdownDocument>()

	constructor(documents: MarkdownDocument[] = []) {
		documents.forEach((document) => this.documents.set(document.id, document))
	}

	async load(id: DocumentId): Promise<MarkdownDocument | null> {
		return this.documents.get(id) ?? null
	}

	async save(document: MarkdownDocument): Promise<void> {
		if (this.saveError) {
			throw this.saveError
		}

		this.savedDocuments.push(document)
		this.documents.set(document.id, document)
	}

	async delete(id: DocumentId): Promise<void> {
		this.documents.delete(id)
	}
}

function createDocument(overrides: Partial<MarkdownDocument> = {}): MarkdownDocument {
	return {
		id: 'active-document',
		content: '',
		createdAt: '2026-08-23T00:00:00.000Z',
		updatedAt: '2026-08-23T00:00:00.000Z',
		...overrides,
	}
}

function fixedNow(): Date {
	return new Date('2026-08-23T00:00:00.000Z')
}
