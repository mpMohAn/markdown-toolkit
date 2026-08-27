import { describe, expect, it } from 'vitest'
import { renderMarkdown } from './markdownRenderer'

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
