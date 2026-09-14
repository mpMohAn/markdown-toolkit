import { describe, expect, it } from 'vitest'
import { renderMarkdown, renderPreviewMarkdown } from './markdownRenderer'

describe('renderMarkdown', () => {
	it('renders supported Markdown and GFM constructs', () => {
		const html = renderMarkdown(`
# Heading

A paragraph with *emphasis* and **strong text** plus a [link](https://example.com).

- One
- Two

1. First
2. Second

\`\`\`ts
const value = 1
\`\`\`

| Name | Value |
| --- | --- |
| One | 1 |

- [x] Done
- [ ] To do

~~removed~~
`)

		expect(html).toContain('<h1>Heading</h1>')
		expect(html).toContain(
			'<p>A paragraph with <em>emphasis</em> and <strong>strong text</strong>',
		)
		expect(html).toContain('<a href="https://example.com">link</a>')
		expect(html).toContain('<ul>')
		expect(html).toContain('<ol>')
		expect(html).toContain('<pre><code class="language-ts">const value = 1')
		expect(html).toContain('<table>')
		expect(html).toContain('type="checkbox" checked disabled')
		expect(html).toContain('<del>removed</del>')
	})

	it('keeps dangerous HTML and URLs inert', () => {
		const html = renderMarkdown(`
<script>window.hacked = true</script>
<img src=x onerror="window.hacked = true">
[unsafe](javascript:alert('x'))
`)

		expect(html).not.toContain('<script')
		expect(html).not.toContain('onerror')
		expect(html).not.toContain('javascript:')
		expect(html).not.toContain('window.hacked')
	})
})

describe('renderPreviewMarkdown', () => {
	it('keeps ordinary fences as code and extracts Mermaid fences as trusted placeholders', () => {
		const rendered = renderPreviewMarkdown(
			`\`\`\`js\nconst value = 1\n\`\`\`\n\n\`\`\`mermaid\nflowchart TD\n A --> B\n\`\`\``,
		)

		expect(rendered.html).toContain('<pre><code class="language-js">')
		expect(rendered.html).toContain('class="mermaid-diagram"')
		expect(rendered.html).toContain('aria-label="Mermaid diagram"')
		expect(rendered.mermaidBlocks).toHaveLength(1)
		expect(rendered.mermaidBlocks[0]?.source).toContain('flowchart TD')
	})

	it('assigns distinct stable IDs to multiple diagrams', () => {
		const source = `\`\`\`mermaid\nflowchart TD\n A --> B\n\`\`\`\n\n\`\`\`mermaid\nsequenceDiagram\n A->>B: Hi\n\`\`\``
		const first = renderPreviewMarkdown(source)
		const second = renderPreviewMarkdown(source)

		expect(new Set(first.mermaidBlocks.map(({ id }) => id)).size).toBe(2)
		expect(second.mermaidBlocks.map(({ id }) => id)).toEqual(
			first.mermaidBlocks.map(({ id }) => id),
		)
	})

	it('does not let raw HTML inject a trusted Mermaid placeholder', () => {
		const rendered = renderPreviewMarkdown(
			'<div class="mermaid-diagram" data-mermaid-id="mermaid-hostile">bad</div>',
		)

		expect(rendered.mermaidBlocks).toEqual([])
		expect(rendered.html).not.toContain('data-mermaid-id')
	})
})
