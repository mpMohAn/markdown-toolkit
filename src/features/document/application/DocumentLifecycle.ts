import type { DocumentRepository } from '../domain/DocumentRepository'
import { createEmptyDocument, type DocumentId, type MarkdownDocument } from '../domain/document'

export const ACTIVE_DOCUMENT_ID = 'active-document'
export const AUTOSAVE_DELAY_MS = 750

export type DocumentPersistenceStatus = 'loading' | 'ready' | 'dirty' | 'saving' | 'saved' | 'error'

export interface DocumentLifecycleState {
	status: DocumentPersistenceStatus
	document: MarkdownDocument | null
	error: string | null
}

interface DocumentLifecycleOptions {
	repository: DocumentRepository
	documentId?: DocumentId
	autosaveDelayMs?: number
	now?: () => Date
}

type Listener = (state: DocumentLifecycleState) => void

export class DocumentLifecycle {
	private readonly autosaveDelayMs: number
	private readonly documentId: DocumentId
	private readonly now: () => Date
	private readonly repository: DocumentRepository
	private readonly listeners = new Set<Listener>()
	private state: DocumentLifecycleState = { status: 'loading', document: null, error: null }
	private saveTimer: ReturnType<typeof setTimeout> | undefined
	private revision = 0
	private hydrationPromise: Promise<void> | undefined

	constructor(options: DocumentLifecycleOptions) {
		this.repository = options.repository
		this.documentId = options.documentId ?? ACTIVE_DOCUMENT_ID
		this.autosaveDelayMs = options.autosaveDelayMs ?? AUTOSAVE_DELAY_MS
		this.now = options.now ?? (() => new Date())
	}

	getState(): DocumentLifecycleState {
		return this.state
	}

	subscribe(listener: Listener): () => void {
		this.listeners.add(listener)

		return () => this.listeners.delete(listener)
	}

	hydrate(): Promise<void> {
		if (this.hydrationPromise) {
			return this.hydrationPromise
		}

		this.setState({ status: 'loading', document: null, error: null })
		this.hydrationPromise = this.hydrateDocument().finally(() => {
			this.hydrationPromise = undefined
		})

		return this.hydrationPromise
	}

	updateContent(content: string): void {
		const document = this.state.document

		if (!document || document.content === content) {
			return
		}

		this.revision += 1
		this.setState({
			status: 'dirty',
			document: { ...document, content, updatedAt: this.now().toISOString() },
			error: null,
		})
		this.scheduleSave()
	}

	private async hydrateDocument(): Promise<void> {
		try {
			const existingDocument = await this.repository.load(this.documentId)

			if (existingDocument) {
				this.setState({ status: 'ready', document: existingDocument, error: null })
				return
			}

			const document = createEmptyDocument(this.documentId, this.now())
			this.setState({ status: 'saving', document, error: null })
			await this.repository.save(document)
			this.setState({ status: 'saved', document, error: null })
		} catch (error) {
			this.setState({
				status: 'error',
				document: this.state.document,
				error: getErrorMessage(error),
			})
		}
	}

	private scheduleSave(): void {
		if (this.saveTimer) {
			clearTimeout(this.saveTimer)
		}

		this.saveTimer = setTimeout(() => {
			void this.saveCurrentDocument()
		}, this.autosaveDelayMs)
	}

	private async saveCurrentDocument(): Promise<void> {
		const document = this.state.document

		if (!document) {
			return
		}

		const revisionToSave = this.revision
		this.setState({ status: 'saving', document, error: null })

		try {
			await this.repository.save(document)

			if (this.revision === revisionToSave) {
				this.setState({ status: 'saved', document, error: null })
			}
		} catch (error) {
			if (this.revision === revisionToSave) {
				this.setState({ status: 'error', document, error: getErrorMessage(error) })
			}
		}
	}

	private setState(state: DocumentLifecycleState): void {
		this.state = state
		this.listeners.forEach((listener) => listener(this.state))
	}
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Unable to save your document locally.'
}
