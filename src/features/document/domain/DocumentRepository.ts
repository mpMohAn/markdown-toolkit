import type { DocumentId, MarkdownDocument } from './document'

export interface DocumentRepository {
	load(id: DocumentId): Promise<MarkdownDocument | null>
	save(document: MarkdownDocument): Promise<void>
	delete(id: DocumentId): Promise<void>
}
