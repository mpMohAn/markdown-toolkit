export interface DocumentIdentity {
	title: string
	displayFilename: string
	safeBasename: string
}

const FALLBACK_TITLE = 'Untitled'

export function deriveDocumentIdentity(markdown: string): DocumentIdentity {
	const title = findFirstH1(markdown) ?? FALLBACK_TITLE
	return {
		title,
		displayFilename: `${title}.md`,
		safeBasename: toSafeBasename(title),
	}
}

function findFirstH1(markdown: string): string | null {
	let fence: { marker: '`' | '~'; length: number } | null = null
	let inComment = false

	for (const sourceLine of markdown.split(/\r?\n/)) {
		const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(sourceLine)
		if (fenceMatch) {
			const marker = fenceMatch[1][0] as '`' | '~'
			if (!fence) fence = { marker, length: fenceMatch[1].length }
			else if (
				marker === fence.marker &&
				fenceMatch[1].length >= fence.length &&
				new RegExp(`^ {0,3}${escapeRegExp(marker)}{${fence.length},}[ \\t]*$`).test(
					sourceLine,
				)
			) {
				fence = null
			}
			continue
		}
		if (fence) continue

		const { text: line, inComment: nextCommentState } = removeHtmlComments(
			sourceLine,
			inComment,
		)
		inComment = nextCommentState
		const heading = /^ {0,3}#[ \t]+(.+)$/.exec(line)
		if (!heading) continue

		const withoutClosingMarker = heading[1].replace(/[ \t]+#+[ \t]*$/, '')
		const title = inlineMarkdownToText(withoutClosingMarker)
		if (title) return title
	}

	return null
}

function removeHtmlComments(line: string, startsInComment: boolean) {
	let text = ''
	let cursor = 0
	let inComment = startsInComment

	while (cursor < line.length) {
		if (inComment) {
			const end = line.indexOf('-->', cursor)
			if (end === -1) return { text, inComment: true }
			inComment = false
			cursor = end + 3
			continue
		}
		const start = line.indexOf('<!--', cursor)
		if (start === -1) {
			text += line.slice(cursor)
			break
		}
		text += line.slice(cursor, start)
		inComment = true
		cursor = start + 4
	}

	return { text, inComment }
}

function inlineMarkdownToText(markdown: string): string {
	return decodeTextEntities(
		markdown
			.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
			.replace(/<((?:https?:\/\/|mailto:)[^>]+)>/gi, '$1')
			.replace(/(`+)(.*?)\1/g, '$2')
			.replace(/<[^>]*>/g, '')
			.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1')
			.replace(/[*_~]/g, ''),
	)
		.replace(/\s+/g, ' ')
		.trim()
}

function decodeTextEntities(text: string): string {
	const named: Record<string, string> = {
		amp: '&',
		apos: "'",
		gt: '>',
		lt: '<',
		nbsp: ' ',
		quot: '"',
	}
	return text.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (entity, decimal, hex, name) => {
		if (decimal || hex) {
			const codePoint = Number.parseInt(decimal ?? hex, decimal ? 10 : 16)
			try {
				return String.fromCodePoint(codePoint)
			} catch {
				return entity
			}
		}
		return named[String(name).toLowerCase()] ?? entity
	})
}

function toSafeBasename(title: string): string {
	const basename = title
		.normalize('NFKD')
		.toLocaleLowerCase('en')
		.replace(/[^\p{L}\p{N}]+/gu, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
		.replace(/-+$/g, '')
	return basename || 'untitled'
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
