import { describe, expect, it } from 'vitest'
import { getMarkdownContinuation } from './markdownAutocomplete'

describe('getMarkdownContinuation', () => {
	it.each([
		['heading', '## Heading', '## '],
		['H1', '# Heading', '# '],
		['H6', '###### Heading', '###### '],
		['bullet', '- item', '- '],
		['star bullet', '* item', '* '],
		['plus bullet', '+ item', '+ '],
		['nested bullet', '  - item', '  - '],
		['task', '- [ ] task', '- [ ] '],
		['completed task', '- [x] done', '- [ ] '],
		['ordered', '1. one', '2. '],
		['ordered progression', '9. item', '10. '],
		['nested ordered', '  3. item', '  4. '],
		['blockquote', '> text', '> '],
	] as const)('suggests a %s continuation', (_name, previousLine, expected) => {
		expect(continuationAfter(previousLine)).toEqual({
			text: expected,
			type: expectedType(previousLine),
		})
	})

	it('uses existing indentation on a whitespace-only current line', () => {
		const documentText = '  - item\n  '

		expect(
			getMarkdownContinuation({
				documentText,
				cursorOffset: documentText.length,
			}),
		).toEqual({ text: '- ', type: 'unordered-list' })
	})

	it('does not suggest after a normal paragraph', () => {
		expect(continuationAfter('normal paragraph')).toBeNull()
	})

	it('does not suggest after an empty list marker', () => {
		expect(continuationAfter('- ')).toBeNull()
		expect(continuationAfter('- [ ] ')).toBeNull()
	})

	it('does not suggest inside a fenced code block', () => {
		const documentText = '```md\n- item\n'

		expect(
			getMarkdownContinuation({
				documentText,
				cursorOffset: documentText.length,
			}),
		).toBeNull()
	})

	it('does not suggest when the selection is non-empty', () => {
		const documentText = '## Heading\n'

		expect(
			getMarkdownContinuation({
				documentText,
				cursorOffset: documentText.length,
				selectionFrom: 0,
				selectionTo: 2,
			}),
		).toBeNull()
	})

	it('does not suggest when the cursor line has content', () => {
		const documentText = '## Heading\nstarted'

		expect(
			getMarkdownContinuation({
				documentText,
				cursorOffset: documentText.length,
			}),
		).toBeNull()
	})

	describe('code-block structural continuation', () => {
		it.each([
			['|-- src', '|-- '],
			['|---- src', '|---- '],
			['|-------- src', '|-------- '],
			['+-- src', '+-- '],
			['\\-- src', '\\-- '],
			['├── src', '├── '],
			['│   ├── child', '│   ├── '],
			['│   |-- child', '│   |-- '],
			['    |---- child', '    |---- '],
		] as const)('preserves the exact prefix from %s', (previousLine, expected) => {
			expect(fencedContinuation(previousLine)).toEqual({
				text: expected,
				type: 'code-block-structural',
			})
		})

		it.each([
			'hello | world',
			'a-b',
			'price | value',
			'value--other',
			'const x = a + b',
			'path \\ value',
			'|---- ',
			'└── last',
		])('does not treat %s as a structural prefix', (previousLine) => {
			expect(fencedContinuation(previousLine)).toBeNull()
		})

		it.each([
			'# heading-looking text',
			'- item-looking text',
			'- [ ] task',
			'1. item',
			'> quote',
		])('does not provide Markdown continuation for %s inside a fence', (previousLine) => {
			expect(fencedContinuation(previousLine)).toBeNull()
		})

		it('supports tilde fenced blocks', () => {
			expect(fencedContinuation('|---- child', '~~~')).toEqual({
				text: '|---- ',
				type: 'code-block-structural',
			})
		})

		it.each(['```', '~~~'])('does not continue a %s fence delimiter', (fence) => {
			expect(continuationForDocument(`${fence}\n`)).toBeNull()
			expect(fencedContinuation(fence, fence)).toBeNull()
		})

		it.each(['|-- Root', '├── Root'])(
			'does not provide structural continuation for %s outside a fence',
			(previousLine) => {
				expect(continuationAfter(previousLine)).toBeNull()
			},
		)
	})

	describe('repeated heading-pattern inference', () => {
		it('suggests H2 after two H2 sections and later ordinary content', () => {
			expect(
				continuationForDocument(
					'# Project\n\n## Installation\n\ncontent\n\n## Configuration\n\ncontent\n',
				),
			).toEqual({ text: '## ', type: 'learned-heading' })
		})

		it('does not learn from one heading occurrence', () => {
			expect(continuationForDocument('## Installation\n\ncontent\n')).toBeNull()
		})

		it('learns a repeated H3 pattern', () => {
			expect(
				continuationForDocument('### One\n\ncontent\n\n### Two\n\nmore content\n'),
			).toEqual({ text: '### ', type: 'learned-heading' })
		})

		it('prefers the heading level with the most recent qualifying occurrence', () => {
			const documentText = '## One\nbody\n## Two\nbody\n### Alpha\nbody\n### Beta\nbody\n'

			expect(continuationForDocument(documentText)).toEqual({
				text: '### ',
				type: 'learned-heading',
			})
		})

		it('does not infer a heading inside a fenced code block', () => {
			const documentText = '## One\nbody\n## Two\nbody\n```md\nordinary content\n'

			expect(continuationForDocument(documentText)).toBeNull()
		})

		it('does not infer a heading with a non-empty selection', () => {
			const documentText = '## One\nbody\n## Two\nordinary content\n'

			expect(
				getMarkdownContinuation({
					documentText,
					cursorOffset: documentText.length,
					selectionFrom: 0,
					selectionTo: 2,
				}),
			).toBeNull()
		})

		it('does not infer a heading on a non-empty line', () => {
			const documentText = '## One\nbody\n## Two\nbody\nstarted'

			expect(continuationForDocument(documentText)).toBeNull()
		})

		it('gives immediate continuation priority over learned headings', () => {
			const documentText = '## One\nbody\n## Two\nbody\n- item\n'

			expect(continuationForDocument(documentText)).toEqual({
				text: '- ',
				type: 'unordered-list',
			})
		})

		it('does not use an outside structural prefix when headings were learned', () => {
			const documentText = '## One\nbody\n## Two\nbody\n|-------- child\n'

			expect(continuationForDocument(documentText)).toBeNull()
		})

		it('does not infer immediately after a repeated heading separated by a blank line', () => {
			expect(continuationForDocument('## One\nbody\n## Two\n\n')).toBeNull()
		})

		it('can infer after a horizontal section break', () => {
			expect(continuationForDocument('## One\nbody\n## Two\nbody\n---\n')).toEqual({
				text: '## ',
				type: 'learned-heading',
			})
		})

		it.each(['- item', '- [ ] task', '> quote'])(
			'does not infer a heading while %s is the active structural context',
			(activeContext) => {
				const documentText = `## One\nbody\n## Two\nbody\n${activeContext}\n\n`
				expect(continuationForDocument(documentText)).toBeNull()
			},
		)
	})
})

function continuationAfter(previousLine: string) {
	const documentText = `${previousLine}\n`
	return getMarkdownContinuation({ documentText, cursorOffset: documentText.length })
}

function continuationForDocument(documentText: string) {
	return getMarkdownContinuation({ documentText, cursorOffset: documentText.length })
}

function fencedContinuation(previousLine: string, fence = '```') {
	return continuationForDocument(`${fence}\n${previousLine}\n`)
}

function expectedType(previousLine: string) {
	if (/^\s*#{1,6}\s/.test(previousLine)) return 'heading'
	if (/^\s*[-*+]\s+\[/.test(previousLine)) return 'task-list'
	if (/^\s*\d+[.)]\s/.test(previousLine)) return 'ordered-list'
	if (/^\s*[-*+]\s/.test(previousLine)) return 'unordered-list'
	return 'blockquote'
}
