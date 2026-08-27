import { useCallback, useEffect, useState } from 'react'
import { createBrowserDocumentLifecycle } from '../application/createBrowserDocumentLifecycle'
import type { DocumentLifecycle, DocumentLifecycleState } from '../application/DocumentLifecycle'

export interface DocumentSession extends DocumentLifecycleState {
	updateContent: (content: string) => void
}

export function useDocumentLifecycle(): DocumentSession {
	const [lifecycle] = useState<DocumentLifecycle>(createBrowserDocumentLifecycle)
	const [state, setState] = useState<DocumentLifecycleState>(() => lifecycle.getState())
	const updateContent = useCallback(
		(content: string) => lifecycle.updateContent(content),
		[lifecycle],
	)

	useEffect(() => {
		const unsubscribe = lifecycle.subscribe(setState)
		void lifecycle.hydrate()

		return unsubscribe
	}, [lifecycle])

	return {
		...state,
		updateContent,
	}
}
