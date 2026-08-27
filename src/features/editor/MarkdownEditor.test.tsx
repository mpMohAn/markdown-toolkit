import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdownEditor } from './MarkdownEditor'

describe('MarkdownEditor', () => {
	it('renders persisted content in an accessible editor', () => {
		render(<MarkdownEditor content="# Persisted" onChange={() => undefined} />)

		expect(screen.getByRole('textbox', { name: 'Markdown editor' })).toHaveTextContent(
			'# Persisted',
		)
	})
})
