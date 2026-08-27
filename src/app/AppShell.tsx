import type { DocumentSession } from '../features/document/ui/useDocumentLifecycle'
import { useDocumentLifecycle } from '../features/document/ui/useDocumentLifecycle'
import { ThemeToggle } from '../features/theme/ThemeToggle'
import { useTheme } from '../features/theme/useTheme'
import { MarkdownWorkspace } from '../features/workspace/MarkdownWorkspace'
import { SkipLink } from '../shared/components/SkipLink'

export function AppShell() {
	const { theme, toggleTheme } = useTheme()
	const documentSession = useDocumentLifecycle()
	const documentStatistics = getDocumentStatistics(documentSession.document?.content ?? '')

	return (
		<div className="app-shell" data-theme={theme}>
			<SkipLink targetId="main-content" />
			<div className="app-toolbar" role="banner">
				<div role="toolbar" aria-label="Workspace controls">
					<ThemeToggle theme={theme} onToggle={toggleTheme} />
				</div>
			</div>

			<main className="app-main" id="main-content" tabIndex={-1}>
				{documentSession.document ? (
					<MarkdownWorkspace
						content={documentSession.document.content}
						onContentChange={documentSession.updateContent}
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
						{documentStatistics.words} words · {documentStatistics.characters}{' '}
						characters
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
