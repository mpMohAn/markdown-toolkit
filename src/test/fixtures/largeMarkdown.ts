const PARAGRAPH =
	'Performance testing should resemble sustained technical writing rather than a single artificial token. This section mixes prose, references, punctuation, and repeated edits so Markdown parsing and editor updates exercise realistic document shapes. The preview should remain readable while the editor keeps selection, history, and scrolling responsive near either end of the document.'

/** Test-only fixture. The default is roughly 15,000 words. */
export function createLargeMarkdownFixture(sectionCount = 100): string {
	return Array.from({ length: sectionCount }, (_, index) => {
		const section = index + 1

		return `# Performance section ${section}

${PARAGRAPH} ${PARAGRAPH}

## Lists and tasks

- Item ${section}.1 with a [reference](https://example.com/performance/${section})
  - Nested item ${section}.1.1
  - Nested item ${section}.1.2
- Item ${section}.2

1. Ordered item ${section}.1
2. Ordered item ${section}.2

- [ ] Review section ${section}
- [x] Generate representative content

## Table

| Section | Metric | Notes |
| --- | ---: | --- |
| ${section} | ${section * 10} | Repeated table content for layout and parsing |
| ${section} | ${section * 20} | A second representative measurement |

## Code

\`\`\`ts
export const section${section} = {
  index: ${section},
  label: 'large Markdown performance fixture',
}
\`\`\`

> Preview updates should stay immediate, and autosave should remain debounced during continuous editing.

---`
	}).join('\n\n')
}
