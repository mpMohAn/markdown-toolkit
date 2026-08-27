import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MarkdownPreview } from './MarkdownPreview'

describe('MarkdownPreview', () => {
	it('renders an accessible empty state', () => {
		render(<MarkdownPreview content="" />)

		expect(screen.getByText('Start writing Markdown…')).toBeInTheDocument()
	})

	it('renders Markdown content', () => {
		render(<MarkdownPreview content="# Hello" />)

		expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument()
	})
})
