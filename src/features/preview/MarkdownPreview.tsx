import { useMemo } from 'react'
import { renderMarkdown } from './markdownRenderer'

interface MarkdownPreviewProps {
	content: string
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
	const renderedMarkdown = useMemo(() => renderMarkdown(content), [content])

	return (
		<article className="markdown-preview" aria-label="Rendered Markdown preview">
			{content ? (
				<div
					className="markdown-preview-content"
					dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
				/>
			) : (
				<p className="markdown-empty-state">Start writing Markdown…</p>
			)}
		</article>
	)
}
