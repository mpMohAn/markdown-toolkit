import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../domain/document'
import { IndexedDbDocumentRepository } from './IndexedDbDocumentRepository'

let databaseNumber = 0

describe('IndexedDbDocumentRepository', () => {
	it('saves and loads a document', async () => {
		const repository = createRepository()
		const document = createEmptyDocument('document-1', new Date('2026-08-23T00:00:00.000Z'))

		await repository.save({ ...document, content: '# Hello' })

		await expect(repository.load(document.id)).resolves.toEqual({
			...document,
			content: '# Hello',
		})
	})

	it('returns null when a document is missing', async () => {
		await expect(createRepository().load('missing')).resolves.toBeNull()
	})

	it('updates an existing document with the same id', async () => {
		const repository = createRepository()
		const document = createEmptyDocument('document-1', new Date('2026-08-23T00:00:00.000Z'))

		await repository.save(document)
		await repository.save({
			...document,
			content: 'Updated',
			updatedAt: '2026-08-23T00:00:01.000Z',
		})

		await expect(repository.load(document.id)).resolves.toMatchObject({ content: 'Updated' })
	})

	it('deletes a document', async () => {
		const repository = createRepository()
		const document = createEmptyDocument('document-1')

		await repository.save(document)
		await repository.delete(document.id)

		await expect(repository.load(document.id)).resolves.toBeNull()
	})

	it('treats malformed stored data as missing', async () => {
		const databaseName = nextDatabaseName()
		const repository = new IndexedDbDocumentRepository({ databaseName })

		await writeRawDocument(databaseName, { id: 'corrupt', content: 42 })

		await expect(repository.load('corrupt')).resolves.toBeNull()
	})
})

function createRepository(): IndexedDbDocumentRepository {
	return new IndexedDbDocumentRepository({ databaseName: nextDatabaseName() })
}

function nextDatabaseName(): string {
	databaseNumber += 1
	return `document-repository-test-${databaseNumber}`
}

function writeRawDocument(databaseName: string, document: unknown): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(databaseName, 1)
		request.onupgradeneeded = () =>
			request.result.createObjectStore('documents', { keyPath: 'id' })
		request.onerror = () => reject(request.error)
		request.onsuccess = () => {
			const transaction = request.result.transaction('documents', 'readwrite')
			transaction.objectStore('documents').put(document)
			transaction.oncomplete = () => {
				request.result.close()
				resolve()
			}
			transaction.onerror = () => reject(transaction.error)
		}
	})
}
