import { IndexedDbDocumentRepository } from '../infrastructure/IndexedDbDocumentRepository'
import { DocumentLifecycle } from './DocumentLifecycle'

export function createBrowserDocumentLifecycle(): DocumentLifecycle {
	return new DocumentLifecycle({ repository: new IndexedDbDocumentRepository() })
}
