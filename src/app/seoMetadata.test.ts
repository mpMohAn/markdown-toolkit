import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import indexHtml from '../../index.html?raw'

const TITLE = 'Markdown Toolkit — Private Markdown Editor'
const DESCRIPTION =
	'Write, format, preview, and export Markdown privately in your browser, with Mermaid diagrams and optional Chrome built-in AI.'
const CANONICAL_URL = 'https://markdown-toolkit.pages.dev/'
const SOCIAL_IMAGE_URL = `${CANONICAL_URL}social-preview.png`

function parseIndex() {
	return new DOMParser().parseFromString(indexHtml, 'text/html')
}

function contentFor(document: Document, selector: string) {
	return document.querySelector<HTMLMetaElement>(selector)?.content
}

describe('production discovery metadata', () => {
	it('defines one approved title, description and canonical URL', () => {
		const document = parseIndex()
		expect(document.querySelectorAll('title')).toHaveLength(1)
		expect(document.title).toBe(TITLE)
		expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1)
		expect(contentFor(document, 'meta[name="description"]')).toBe(DESCRIPTION)
		expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1)
		expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
			CANONICAL_URL,
		)
		expect(document.querySelector('meta[name="keywords"]')).toBeNull()
	})

	it('provides complete Open Graph and Twitter card metadata', () => {
		const document = parseIndex()
		const openGraph = {
			'og:type': 'website',
			'og:site_name': 'Markdown Toolkit',
			'og:title': TITLE,
			'og:description': DESCRIPTION,
			'og:url': CANONICAL_URL,
			'og:image': SOCIAL_IMAGE_URL,
			'og:image:width': '1200',
			'og:image:height': '630',
			'og:image:alt': 'Markdown Toolkit private Markdown editor and preview',
			'og:locale': 'en_US',
		}
		for (const [property, value] of Object.entries(openGraph)) {
			expect(contentFor(document, `meta[property="${property}"]`)).toBe(value)
		}

		const twitter = {
			'twitter:card': 'summary_large_image',
			'twitter:title': TITLE,
			'twitter:description': DESCRIPTION,
			'twitter:image': SOCIAL_IMAGE_URL,
			'twitter:image:alt': 'Markdown Toolkit private Markdown editor and preview',
		}
		for (const [name, value] of Object.entries(twitter)) {
			expect(contentFor(document, `meta[name="${name}"]`)).toBe(value)
		}
		expect(SOCIAL_IMAGE_URL).toMatch(/^https:\/\//)
		expect(document.querySelector('meta[name="twitter:site"]')).toBeNull()
		expect(document.querySelector('meta[name="twitter:creator"]')).toBeNull()
	})

	it('contains one valid SoftwareApplication JSON-LD block with released facts only', () => {
		const document = parseIndex()
		const blocks = document.querySelectorAll<HTMLScriptElement>(
			'script[type="application/ld+json"]',
		)
		expect(blocks).toHaveLength(1)
		const data = JSON.parse(blocks[0].textContent ?? '') as Record<string, unknown>
		expect(data).toMatchObject({
			'@context': 'https://schema.org',
			'@type': 'SoftwareApplication',
			name: 'Markdown Toolkit',
			description: DESCRIPTION,
			url: CANONICAL_URL,
			applicationCategory: 'DeveloperApplication',
			operatingSystem: 'Web',
			author: {
				'@type': 'Person',
				name: 'Mohan Pattar',
				url: 'https://github.com/mpMohAn',
			},
			codeRepository: 'https://github.com/mpMohAn/markdown-toolkit',
			offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
			featureList: [
				'Markdown editing',
				'Live sanitized preview',
				'Deterministic Markdown formatting',
				'Mermaid diagram preview',
				'Local browser autosave',
				'Markdown and HTML copy/download',
				'Optional Chrome built-in AI writing',
				'Light and dark themes',
			],
		})
		for (const unsupported of ['aggregateRating', 'review', 'reviewCount', 'downloadCount']) {
			expect(data).not.toHaveProperty(unsupported)
		}
	})

	it('keeps favicons and application bootstrap markup without manual analytics', () => {
		const document = parseIndex()
		expect(document.querySelector('meta[charset]')).not.toBeNull()
		expect(document.querySelector('meta[name="viewport"]')).not.toBeNull()
		expect(document.querySelectorAll('link[rel="icon"]')).toHaveLength(2)
		expect(document.querySelector('link[rel="apple-touch-icon"]')).not.toBeNull()
		expect(document.querySelector('#root')).not.toBeNull()
		expect(document.querySelector('script[type="module"][src="/src/main.tsx"]')).not.toBeNull()
		expect(indexHtml).not.toMatch(
			/cloudflareinsights|beacon\.min\.js|google-analytics|googletagmanager|gtag\(|dataLayer/i,
		)
	})
})

describe('crawl and social assets', () => {
	it('allows crawling and points robots to the one-page sitemap', () => {
		const robots = readFileSync('public/robots.txt', 'utf8')
		expect(robots).toContain('User-agent: *')
		expect(robots).toContain('Allow: /')
		expect(robots).toContain(`Sitemap: ${CANONICAL_URL}sitemap.xml`)
		expect(robots).not.toMatch(/^Disallow:\s*\/$/m)
	})

	it('publishes a valid sitemap containing only the canonical root URL', () => {
		const sitemap = readFileSync('public/sitemap.xml', 'utf8')
		const document = new DOMParser().parseFromString(sitemap, 'application/xml')
		expect(document.querySelector('parsererror')).toBeNull()
		expect(document.documentElement.namespaceURI).toBe(
			'http://www.sitemaps.org/schemas/sitemap/0.9',
		)
		expect(Array.from(document.querySelectorAll('loc'), (node) => node.textContent)).toEqual([
			CANONICAL_URL,
		])
	})

	it('ships a genuine 1200 by 630 PNG social card', () => {
		const png = readFileSync('public/social-preview.png')
		expect(Array.from(png.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
		expect(png.readUInt32BE(16)).toBe(1200)
		expect(png.readUInt32BE(20)).toBe(630)
	})
})
