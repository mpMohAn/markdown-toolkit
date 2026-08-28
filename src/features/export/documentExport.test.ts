import { describe, expect, it, vi } from 'vitest'
import { renderMarkdown } from '../preview/markdownRenderer'
import { COMBINED_SECURITY_MARKDOWN } from '../../test/fixtures/securityMarkdown'
import { copyDocument, createDocumentArtifact, downloadDocument } from './documentExport'

describe('document export', () => {
	const markdown = '# Sample Document\n\n- one\n- two\n\n```ts\nconst value = 1\n```\n'

	it('copies the exact Markdown source', async () => {
		const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }

		expect(await copyDocument(markdown, 'markdown', clipboard)).toBe(true)
		expect(clipboard.writeText).toHaveBeenCalledWith(markdown)
	})

	it('copies only HTML from the existing sanitized renderer', async () => {
		const unsafeMarkdown =
			'# Safe\n\n<script>window.hacked = true</script>\n[bad](javascript:alert(1))'
		const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }

		expect(await copyDocument(unsafeMarkdown, 'html', clipboard)).toBe(true)
		expect(clipboard.writeText).toHaveBeenCalledWith(renderMarkdown(unsafeMarkdown))
		const copiedHtml = clipboard.writeText.mock.calls[0][0]
		expect(copiedHtml).not.toContain('<script')
		expect(copiedHtml).not.toContain('javascript:')
		expect(copiedHtml).not.toContain('<html')
	})

	it('reports clipboard failures without throwing', async () => {
		const clipboard = { writeText: vi.fn().mockRejectedValue(new Error('Denied')) }

		expect(await copyDocument(markdown, 'markdown', clipboard)).toBe(false)
	})

	it('reports an unavailable Clipboard API without claiming success', async () => {
		expect(await copyDocument(markdown, 'markdown', undefined)).toBe(false)
	})

	it('creates an exact UTF-8 Markdown download with a safe H1 filename', () => {
		const artifact = createDocumentArtifact(
			'# Hello, **World!**\n\n  Preserve me.\n',
			'markdown',
		)

		expect(artifact).toEqual({
			content: '# Hello, **World!**\n\n  Preserve me.\n',
			filename: 'hello-world.md',
			mimeType: 'text/markdown;charset=utf-8',
		})
	})

	it('creates a standalone sanitized HTML download', () => {
		const artifact = createDocumentArtifact(
			'# Safe Export\n\n**Hello**\n\n<script>alert("bad")</script>',
			'html',
		)

		expect(artifact.filename).toBe('safe-export.html')
		expect(artifact.mimeType).toBe('text/html;charset=utf-8')
		expect(artifact.content).toMatch(/^<!doctype html>/)
		expect(artifact.content).toContain('<html lang="en">')
		expect(artifact.content).toContain('<meta charset="UTF-8">')
		expect(artifact.content).toContain('<meta name="viewport"')
		expect(artifact.content).toContain('<title>Safe Export</title>')
		expect(artifact.content).toContain('<strong>Hello</strong>')
		expect(artifact.content).not.toContain('<script')
		expect(artifact.content).not.toContain('alert(')
	})

	it('uses fallback filenames when no usable H1 exists', () => {
		expect(createDocumentArtifact('Paragraph only', 'markdown').filename).toBe('untitled.md')
		expect(createDocumentArtifact('# !!!', 'html').filename).toBe('untitled.html')
	})

	it('uses the same sanitized HTML for copy and standalone download', async () => {
		const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) }
		const sanitizedHtml = renderMarkdown(COMBINED_SECURITY_MARKDOWN)

		await copyDocument(COMBINED_SECURITY_MARKDOWN, 'html', clipboard)
		const artifact = createDocumentArtifact(COMBINED_SECURITY_MARKDOWN, 'html')

		expect(clipboard.writeText).toHaveBeenCalledWith(sanitizedHtml)
		expect(artifact.content).toContain(sanitizedHtml)
		expect(artifact.content).not.toMatch(/<script|\son\w+=|(?:javascript|data):/i)
	})

	it('defers object URL revocation until after download cleanup', () => {
		vi.useFakeTimers()
		const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
		const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
		const click = vi
			.spyOn(HTMLAnchorElement.prototype, 'click')
			.mockImplementation(() => undefined)

		downloadDocument(markdown, 'markdown')

		expect(createObjectURL).toHaveBeenCalledOnce()
		expect(click).toHaveBeenCalledOnce()
		expect(document.querySelector('a[download]')).not.toBeInTheDocument()
		expect(revokeObjectURL).not.toHaveBeenCalled()

		vi.runAllTimers()
		expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
		vi.useRealTimers()
	})
})
