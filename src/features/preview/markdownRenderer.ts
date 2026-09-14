import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'

const markdownProcessor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	// Raw HTML is deliberately not enabled. Markdown syntax is rendered, while HTML input remains inert.
	.use(remarkRehype)
	.use(rehypeSanitize)
	.use(rehypeStringify)

const previewMarkdownProcessor = unified()
	.use(remarkParse)
	.use(remarkGfm)
	.use(remarkRehype)
	.use(mermaidPlaceholderPlugin)
	.use(rehypeSanitize, {
		...defaultSchema,
		attributes: {
			...defaultSchema.attributes,
			div: [
				...(defaultSchema.attributes?.div ?? []),
				['className', 'mermaid-diagram'],
				['dataMermaidId', /^mermaid-[a-z0-9-]+$/],
				['ariaLabel', 'Mermaid diagram'],
				['role', 'img'],
			],
		},
	})
	.use(rehypeStringify)

export function renderMarkdown(content: string): string {
	return markdownProcessor.processSync(content).toString()
}

export interface MermaidBlock {
	id: string
	source: string
}

export function renderPreviewMarkdown(content: string): {
	html: string
	mermaidBlocks: MermaidBlock[]
} {
	const file = previewMarkdownProcessor.processSync(content)
	return {
		html: file.toString(),
		mermaidBlocks: (file.data.mermaidBlocks as MermaidBlock[] | undefined) ?? [],
	}
}

interface HastNode {
	type: string
	tagName?: string
	value?: string
	properties?: Record<string, unknown>
	children?: HastNode[]
}

function mermaidPlaceholderPlugin() {
	return (tree: HastNode, file: { data: Record<string, unknown> }) => {
		const blocks: MermaidBlock[] = []
		visit(tree, (node) => {
			if (node.tagName !== 'pre' || node.children?.length !== 1) return
			const code = node.children[0]
			const classes = code.properties?.className
			if (
				code.tagName !== 'code' ||
				!Array.isArray(classes) ||
				!classes.includes('language-mermaid')
			) {
				return
			}
			const source = code.children?.map((child) => child.value ?? '').join('') ?? ''
			const id = stableMermaidId(source, blocks.length)
			blocks.push({ id, source })
			node.tagName = 'div'
			node.properties = {
				className: ['mermaid-diagram'],
				dataMermaidId: id,
				role: 'img',
				ariaLabel: 'Mermaid diagram',
			}
			node.children = []
		})
		file.data.mermaidBlocks = blocks
	}
}

function visit(node: HastNode, callback: (node: HastNode) => void) {
	callback(node)
	for (const child of node.children ?? []) visit(child, callback)
}

function stableMermaidId(source: string, index: number): string {
	let hash = 2166136261
	for (let offset = 0; offset < source.length; offset += 1) {
		hash ^= source.charCodeAt(offset)
		hash = Math.imul(hash, 16777619)
	}
	return `mermaid-${index}-${(hash >>> 0).toString(36)}`
}
