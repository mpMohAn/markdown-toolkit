import type { EditorView } from '@codemirror/view'
import { useCallback, useMemo, useState } from 'react'
import { AICleanup } from '../features/ai/AICleanup'
import type { AIProvider } from '../features/ai/AIProvider'
import { AboutMenu } from '../features/about/AboutMenu'
import type { DocumentSession } from '../features/document/ui/useDocumentLifecycle'
import { useDocumentLifecycle } from '../features/document/ui/useDocumentLifecycle'
import { deriveDocumentIdentity } from '../features/document/domain/documentIdentity'
import { EditorToolbar } from '../features/editor/EditorToolbar'
import { DocumentActions } from '../features/export/DocumentActions'
import { ThemeToggle } from '../features/theme/ThemeToggle'
import { useTheme } from '../features/theme/useTheme'
import { MarkdownWorkspace } from '../features/workspace/MarkdownWorkspace'
import { readLineNumbers, writeLineNumbers } from '../features/workspace/workspacePreferences'
import { SkipLink } from '../shared/components/SkipLink'
import { ToolbarMenuProvider } from '../shared/components/ToolbarMenu'

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
	const documentIdentity = useMemo(
		() => deriveDocumentIdentity(documentContent),
		[documentContent],
	)

	return (
		<div className="app-shell" data-theme={theme}>
			<SkipLink targetId="main-content" />
			<div className="app-toolbar" role="banner">
				<ToolbarMenuProvider>
					<div className="toolbar-content" role="toolbar" aria-label="Markdown Toolkit">
						<div className="toolbar-region toolbar-region-left">
							<div className="app-brand" role="img" aria-label="Markdown Toolkit">
								<img src="/favicon-32x32.png" alt="" width="24" height="24" />
							</div>
							<EditorToolbar
								editorView={editorView}
								showLineNumbers={showLineNumbers}
								onToggleLineNumbers={toggleLineNumbers}
							/>
						</div>
						<div className="toolbar-region toolbar-region-center">
							<div
								className="toolbar-document-name"
								title={documentIdentity.displayFilename}
								aria-label={`Current document: ${documentIdentity.displayFilename}`}
							>
								{documentIdentity.displayFilename}
							</div>
						</div>
						<div className="toolbar-region toolbar-region-right">
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
							<AboutMenu />
							<ThemeToggle theme={theme} onToggle={toggleTheme} />
						</div>
					</div>
				</ToolbarMenuProvider>
			</div>

			<main className="app-main" id="main-content" tabIndex={-1}>
				{documentSession.document ? (
					<MarkdownWorkspace
						content={documentSession.document.content}
						onContentChange={documentSession.updateContent}
						onEditorReady={handleEditorReady}
						showLineNumbers={showLineNumbers}
						theme={theme}
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
