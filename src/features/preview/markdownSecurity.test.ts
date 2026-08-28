import { describe, expect, it } from 'vitest'
import {
	COMBINED_SECURITY_MARKDOWN,
	MARKDOWN_SECURITY_CASES,
} from '../../test/fixtures/securityMarkdown'
import { renderMarkdown } from './markdownRenderer'

describe('Markdown rendering security', () => {
	it.each(MARKDOWN_SECURITY_CASES)('sanitizes %s', (_name, markdown) => {
		assertSafeHtml(renderMarkdown(markdown))
	})

	it('sanitizes nested attacks when rendered together', () => {
		assertSafeHtml(renderMarkdown(COMBINED_SECURITY_MARKDOWN))
	})

	it('keeps safe external links in the current browsing context', () => {
		const html = renderMarkdown('[Safe](https://example.com)')
		const document = parseFragment(html)
		const link = document.querySelector('a')

		expect(link?.getAttribute('href')).toBe('https://example.com')
		expect(link?.hasAttribute('target')).toBe(false)
	})
})

function assertSafeHtml(html: string) {
	const document = parseFragment(html)

	expect(document.querySelector('script, iframe, object, embed, style')).toBeNull()
	for (const element of document.querySelectorAll('*')) {
		for (const attribute of element.attributes) {
			expect(attribute.name.toLowerCase()).not.toMatch(/^on/)
			if (attribute.name === 'href' || attribute.name === 'src') {
				expect(attribute.value.trim().toLowerCase()).not.toMatch(/^(javascript|data):/)
			}
		}
	}
}

function parseFragment(html: string) {
	return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
}
