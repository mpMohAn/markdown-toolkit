import type { EditorView } from '@codemirror/view'
import { useCallback, useMemo, useState } from 'react'
import { AICleanup } from '../features/ai/AICleanup'
import type { AIProvider } from '../features/ai/AIProvider'
import type { DocumentSession } from '../features/document/ui/useDocumentLifecycle'
import { useDocumentLifecycle } from '../features/document/ui/useDocumentLifecycle'
import { EditorToolbar } from '../features/editor/EditorToolbar'
import { DocumentActions } from '../features/export/DocumentActions'
import { ThemeToggle } from '../features/theme/ThemeToggle'
import { useTheme } from '../features/theme/useTheme'
import { MarkdownWorkspace } from '../features/workspace/MarkdownWorkspace'
import { readLineNumbers, writeLineNumbers } from '../features/workspace/workspacePreferences'
import { SkipLink } from '../shared/components/SkipLink'

export function AppShell({ aiProviderFactory }: { aiProviderFactory?: () => AIProvider } = {}) {
	const { theme, toggleTheme } = useTheme()
	const documentSession = useDocumentLifecycle()
	const [editorView, setEditorView] = useState<EditorView | null>(null)
	const [showLineNumbers, setShowLineNumbers] = useState(readLineNumbers)
	const handleEditorReady = useCallback((view: EditorView | null) => setEditorView(view), [])
	const toggleLineNumbers = useCallback(() => {
		setShowLineNumbers((currentValue) => {
			const nextValue = !currentValue
			writeLineNumbers(nextValue)
			return nextValue
		})
	}, [])
	const documentContent = documentSession.document?.content ?? ''
	const documentStatistics = useMemo(
		() => getDocumentStatistics(documentContent),
		[documentContent],
	)

	return (
		<div className="app-shell" data-theme={theme}>
			<SkipLink targetId="main-content" />
			<div className="app-toolbar" role="banner">
				<div className="toolbar-content" role="toolbar" aria-label="Markdown tools">
					<EditorToolbar
						editorView={editorView}
						showLineNumbers={showLineNumbers}
						onToggleLineNumbers={toggleLineNumbers}
					/>
					{documentSession.document ? (
						<DocumentActions content={documentSession.document.content} />
					) : null}
					{documentSession.document ? (
						<AICleanup
							content={documentSession.document.content}
							onApply={documentSession.updateContent}
							providerFactory={aiProviderFactory}
						/>
					) : null}
					<div className="workspace-controls">
						<ThemeToggle theme={theme} onToggle={toggleTheme} />
					</div>
				</div>
			</div>

			<main className="app-main" id="main-content" tabIndex={-1}>
				{documentSession.document ? (
					<MarkdownWorkspace
						content={documentSession.document.content}
						onContentChange={documentSession.updateContent}
						onEditorReady={handleEditorReady}
						showLineNumbers={showLineNumbers}
					/>
				) : (
					<section className="workspace-loading" aria-live="polite" aria-busy="true">
						<p>{getDocumentStatusMessage(documentSession)}</p>
					</section>
				)}
			</main>

			<footer className="app-footer">
				{documentSession.document ? (
					<p>
						{documentStatistics.words} words · {documentStatistics.characters} chars
					</p>
				) : null}
				<p role="status">{getDocumentStatusMessage(documentSession)}</p>
			</footer>
		</div>
	)
}

function getDocumentStatistics(content: string): { words: number; characters: number } {
	const trimmedContent = content.trim()

	return {
		words: trimmedContent ? trimmedContent.split(/\s+/).length : 0,
		characters: content.length,
	}
}

function getDocumentStatusMessage({ status }: DocumentSession): string {
	if (status === 'loading') {
		return 'Loading document…'
	}

	if (status === 'error') {
		return 'Save failed'
	}

	if (status === 'saving') {
		return 'Saving…'
	}

	if (status === 'dirty') {
		return 'Unsaved'
	}

	return status === 'saved' ? 'Saved' : 'Ready'
}
