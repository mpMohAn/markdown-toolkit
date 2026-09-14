import { memo, useDeferredValue, useEffect, useMemo, useRef } from 'react'
import type { MermaidLoader, PreviewTheme } from './mermaidRenderer'
import { renderMermaidBlocks } from './mermaidRenderer'
import { renderPreviewMarkdown } from './markdownRenderer'

interface MarkdownPreviewProps {
	content: string
	theme?: PreviewTheme
	mermaidLoader?: MermaidLoader
}

export const MarkdownPreview = memo(function MarkdownPreview({
	content,
	theme = 'light',
	mermaidLoader,
}: MarkdownPreviewProps) {
	const deferredContent = useDeferredValue(content)
	const rendered = useMemo(() => renderPreviewMarkdown(deferredContent), [deferredContent])
	const hasRenderableContent = deferredContent.trim().length > 0
	const contentRef = useRef<HTMLDivElement>(null)
	const generationRef = useRef(0)

	useEffect(() => {
		const root = contentRef.current
		const generation = ++generationRef.current
		const temporaryNodes = new Set<HTMLElement>()
		if (!root || rendered.mermaidBlocks.length === 0) return

		void renderMermaidBlocks({
			root,
			blocks: rendered.mermaidBlocks,
			theme,
			isCurrent: () => generation === generationRef.current,
			onTemporaryNode: (node) => temporaryNodes.add(node),
			loader: mermaidLoader,
		})
		return () => {
			generationRef.current += 1
			for (const node of temporaryNodes) node.remove()
			temporaryNodes.clear()
		}
	}, [mermaidLoader, rendered, theme])

	return (
		<article className="markdown-preview" aria-label="Rendered Markdown preview">
			{hasRenderableContent ? (
				<div
					ref={contentRef}
					className="markdown-preview-content"
					dangerouslySetInnerHTML={{ __html: rendered.html }}
				/>
			) : (
				<p className="markdown-empty-state">Start writing Markdown…</p>
			)}
		</article>
	)
})
