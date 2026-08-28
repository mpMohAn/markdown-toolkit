import { describe, expect, it } from 'vitest'
import markdownQaFixture from '../../../docs/fixtures/v1-markdown-qa.md?raw'
import { renderMarkdown } from './markdownRenderer'

describe('V1 Markdown QA fixture', () => {
	it('renders the reusable fixture with its key GFM structures intact', () => {
		const html = renderMarkdown(markdownQaFixture)

		expect(html).toContain('<h1>V1 Markdown QA Fixture</h1>')
		expect(html).toContain('<h6>Heading 6</h6>')
		expect(html).toContain('<del>strikethrough</del>')
		expect(html).toContain('<pre><code class="language-ts">')
		expect(html).toContain('class="contains-task-list"')
		expect(html).toContain('<blockquote>')
		expect(html).toContain('<table>')
		expect(html).toContain('café, Ελληνικά, हिंदी, 日本語')
		expect(html).toContain('🧰 ✅ 🚀')
	})

	it('recovers from large and deeply nested content', () => {
		const longToken = 'x'.repeat(50_000)
		const nestedList = Array.from(
			{ length: 16 },
			(_, depth) => `${'  '.repeat(depth)}- level ${depth + 1}`,
		).join('\n')
		const markdown = `# Repeated\n\n# Repeated\n\n${nestedList}\n\n| Wide | Value |\n| --- | --- |\n| ${longToken} | ok |\n\n\`\`\`\n${longToken}\n\`\`\``

		const html = renderMarkdown(markdown)

		expect(html).toContain('<h1>Repeated</h1>')
		expect(html).toContain('<table>')
		expect(html).toContain('<pre><code>')
		expect(html).toContain(longToken)
	})
})
