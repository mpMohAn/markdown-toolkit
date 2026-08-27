import type { DocumentRepository } from '../domain/DocumentRepository'
import { isMarkdownDocument, type DocumentId, type MarkdownDocument } from '../domain/document'

const DATABASE_NAME = 'markdown-toolkit'
const DATABASE_VERSION = 1
const DOCUMENT_STORE = 'documents'

interface IndexedDbDocumentRepositoryOptions {
	databaseName?: string
	indexedDb?: IDBFactory
}

export class IndexedDbDocumentRepository implements DocumentRepository {
	private databasePromise: Promise<IDBDatabase> | undefined
	private readonly databaseName: string
	private readonly indexedDb: IDBFactory | undefined

	constructor(options: IndexedDbDocumentRepositoryOptions = {}) {
		this.databaseName = options.databaseName ?? DATABASE_NAME
		this.indexedDb = options.indexedDb ?? globalThis.indexedDB
	}

	async load(id: DocumentId): Promise<MarkdownDocument | null> {
		const database = await this.openDatabase()

		return new Promise((resolve, reject) => {
			const transaction = database.transaction(DOCUMENT_STORE, 'readonly')
			const request = transaction.objectStore(DOCUMENT_STORE).get(id)

			request.onsuccess = () => {
				resolve(isMarkdownDocument(request.result) ? request.result : null)
			}
			request.onerror = () =>
				reject(request.error ?? new Error('Unable to load the document.'))
			transaction.onerror = () =>
				reject(transaction.error ?? new Error('Unable to load the document.'))
		})
	}

	async save(document: MarkdownDocument): Promise<void> {
		if (!isMarkdownDocument(document)) {
			throw new Error('Refusing to persist an invalid document.')
		}

		const database = await this.openDatabase()
		await this.completeTransaction(database, 'readwrite', (store) => store.put(document))
	}

	async delete(id: DocumentId): Promise<void> {
		const database = await this.openDatabase()
		await this.completeTransaction(database, 'readwrite', (store) => store.delete(id))
	}

	private openDatabase(): Promise<IDBDatabase> {
		if (this.databasePromise) {
			return this.databasePromise
		}

		if (!this.indexedDb) {
			return Promise.reject(new Error('IndexedDB is unavailable in this browser.'))
		}

		this.databasePromise = new Promise((resolve, reject) => {
			const request = this.indexedDb?.open(this.databaseName, DATABASE_VERSION)

			if (!request) {
				reject(new Error('IndexedDB is unavailable in this browser.'))
				return
			}

			request.onupgradeneeded = () => {
				const database = request.result

				if (!database.objectStoreNames.contains(DOCUMENT_STORE)) {
					database.createObjectStore(DOCUMENT_STORE, { keyPath: 'id' })
				}
			}
			request.onsuccess = () => resolve(request.result)
			request.onerror = () =>
				reject(request.error ?? new Error('Unable to open local storage.'))
			request.onblocked = () =>
				reject(new Error('Local storage is blocked by another browser tab.'))
		})

		return this.databasePromise
	}

	private completeTransaction(
		database: IDBDatabase,
		mode: IDBTransactionMode,
		operation: (store: IDBObjectStore) => IDBRequest,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			const transaction = database.transaction(DOCUMENT_STORE, mode)
			const request = operation(transaction.objectStore(DOCUMENT_STORE))

			request.onerror = () =>
				reject(request.error ?? new Error('Unable to update the document.'))
			transaction.oncomplete = () => resolve()
			transaction.onerror = () =>
				reject(transaction.error ?? new Error('Unable to update the document.'))
			transaction.onabort = () =>
				reject(transaction.error ?? new Error('Unable to update the document.'))
		})
	}
}
