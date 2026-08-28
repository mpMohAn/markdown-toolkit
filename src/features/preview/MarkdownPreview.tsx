import { memo, useDeferredValue, useMemo } from 'react'
import { renderMarkdown } from './markdownRenderer'

interface MarkdownPreviewProps {
	content: string
}

export const MarkdownPreview = memo(function MarkdownPreview({ content }: MarkdownPreviewProps) {
	const deferredContent = useDeferredValue(content)
	const renderedMarkdown = useMemo(() => renderMarkdown(deferredContent), [deferredContent])
	const hasRenderableContent = deferredContent.trim().length > 0

	return (
		<article className="markdown-preview" aria-label="Rendered Markdown preview">
			{hasRenderableContent ? (
				<div
					className="markdown-preview-content"
					dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
				/>
			) : (
				<p className="markdown-empty-state">Start writing Markdown…</p>
			)}
		</article>
	)
})
