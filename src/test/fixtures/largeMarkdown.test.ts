import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../../features/preview/markdownRenderer'
import { createLargeMarkdownFixture } from './largeMarkdown'

describe('large Markdown performance fixture', () => {
	it('provides a realistic 10k–30k word document outside the production bundle', () => {
		const markdown = createLargeMarkdownFixture()
		const wordCount = markdown.trim().split(/\s+/).length

		expect(wordCount).toBeGreaterThanOrEqual(10_000)
		expect(wordCount).toBeLessThanOrEqual(30_000)
		expect(markdown).toContain('```ts')
		expect(markdown).toContain('| Section | Metric | Notes |')
		expect(markdown).toContain('- [ ] Review section')
	})

	it('renders the fixture through the production Markdown pipeline', () => {
		const html = renderMarkdown(createLargeMarkdownFixture())

		expect(html).toContain('<h1>Performance section 1</h1>')
		expect(html).toContain('<table>')
		expect(html).toContain('<pre><code class="language-ts">')
	})
})
