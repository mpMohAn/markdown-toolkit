import { describe, expect, it } from 'vitest'
import { deriveDocumentIdentity } from './documentIdentity'

describe('document identity', () => {
	it('uses the first valid ATX H1 and readable inline Markdown', () => {
		expect(
			deriveDocumentIdentity(
				'## Ignore\n\n # **Project** [Notes](https://example.com) `v1` ![Logo](logo.png) ##',
			),
		).toEqual({
			title: 'Project Notes v1 Logo',
			displayFilename: 'Project Notes v1 Logo.md',
			safeBasename: 'project-notes-v1-logo',
		})
	})

	it('ignores escaped, fenced, commented, deeper, and Setext headings', () => {
		const markdown = [
			'\\# Escaped',
			'```md',
			'# Fenced',
			'```',
			'<!--',
			'# Commented',
			'-->',
			'Setext',
			'======',
			'## Deeper',
			'   # Actual &amp; Safe',
		].join('\n')

		expect(deriveDocumentIdentity(markdown).displayFilename).toBe('Actual & Safe.md')
	})

	it('supports tilde fences and falls back for missing or unusable headings', () => {
		expect(deriveDocumentIdentity('~~~md\n# Hidden\n~~~\nParagraph').displayFilename).toBe(
			'Untitled.md',
		)
		expect(deriveDocumentIdentity('# ***').displayFilename).toBe('Untitled.md')
	})

	it('allows at most three leading spaces and requires whitespace after one marker', () => {
		expect(deriveDocumentIdentity('    # Too indented\n#No space\n   # Valid').title).toBe(
			'Valid',
		)
	})
})
