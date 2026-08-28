import { renderMarkdown } from '../preview/markdownRenderer'

export type DocumentFormat = 'markdown' | 'html'

interface ClipboardWriter {
	writeText: (content: string) => Promise<void>
}

export interface DocumentArtifact {
	content: string
	filename: string
	mimeType: string
}

export async function copyDocument(
	markdown: string,
	format: DocumentFormat,
	clipboard: ClipboardWriter | undefined = navigator.clipboard,
) {
	if (!clipboard) return false

	try {
		await clipboard.writeText(format === 'markdown' ? markdown : renderMarkdown(markdown))
		return true
	} catch {
		return false
	}
}

export function createDocumentArtifact(markdown: string, format: DocumentFormat): DocumentArtifact {
	const title = getDocumentTitle(markdown)
	const basename = getSafeBasename(title)

	if (format === 'markdown') {
		return {
			content: markdown,
			filename: `${basename}.md`,
			mimeType: 'text/markdown;charset=utf-8',
		}
	}

	return {
		content: createStandaloneHtml(markdown, title),
		filename: `${basename}.html`,
		mimeType: 'text/html;charset=utf-8',
	}
}

export function downloadDocument(markdown: string, format: DocumentFormat) {
	const artifact = createDocumentArtifact(markdown, format)
	const url = URL.createObjectURL(new Blob([artifact.content], { type: artifact.mimeType }))
	const link = document.createElement('a')
	link.href = url
	link.download = artifact.filename
	link.hidden = true
	document.body.append(link)
	link.click()
	link.remove()

	// Let the browser consume the object URL before releasing it. Immediate
	// revocation can race the download in Safari and Firefox.
	setTimeout(() => URL.revokeObjectURL(url), 0)
}

function createStandaloneHtml(markdown: string, title: string) {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
</head>
<body>
${renderMarkdown(markdown)}
</body>
</html>`
}

function getDocumentTitle(markdown: string) {
	const heading = /^\s{0,3}#\s+(.+?)\s*#*\s*$/m.exec(markdown)?.[1]
	if (!heading) return 'Untitled'

	return heading
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/[*_~`]/g, '')
		.trim()
}

function getSafeBasename(title: string) {
	const basename = title
		.normalize('NFKD')
		.toLocaleLowerCase('en')
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
		.replace(/-+$/g, '')

	return basename || 'untitled'
}

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;')
}
