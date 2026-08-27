import rehypeSanitize from 'rehype-sanitize'
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

export function renderMarkdown(content: string): string {
	return markdownProcessor.processSync(content).toString()
}
