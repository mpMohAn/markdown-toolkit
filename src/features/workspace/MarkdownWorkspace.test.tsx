import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MarkdownWorkspace } from './MarkdownWorkspace'

describe('MarkdownWorkspace', () => {
	const storage = new Map<string, string>()

	beforeEach(() => {
		storage.clear()
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
			},
		})
	})

	it('updates the preview from the same content supplied to the editor', () => {
		const { rerender } = render(
			<MarkdownWorkspace content="" onContentChange={() => undefined} />,
		)

		rerender(<MarkdownWorkspace content="# Hello" onContentChange={() => undefined} />)

		expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument()
	})

	it('resizes with arrow keys and persists the split', () => {
		const { unmount } = render(
			<MarkdownWorkspace content="" onContentChange={() => undefined} />,
		)
		const divider = screen.getByRole('separator', { name: 'Resize editor and preview' })

		expect(divider).toHaveAttribute('aria-valuenow', '50')
		fireEvent.keyDown(divider, { key: 'ArrowRight' })
		expect(divider).toHaveAttribute('aria-valuenow', '52')
		expect(storage.get('markdown-toolkit:workspace-split')).toBe('52')

		unmount()
		render(<MarkdownWorkspace content="" onContentChange={() => undefined} />)
		expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '52')
	})

	it('resizes with pointer events, enforces minimum widths, and resets on double-click', () => {
		const { container } = render(
			<MarkdownWorkspace content="" onContentChange={() => undefined} />,
		)
		const workspace = container.querySelector('.markdown-workspace')
		const divider = screen.getByRole('separator')
		vi.spyOn(workspace!, 'getBoundingClientRect').mockReturnValue({
			left: 100,
			width: 800,
		} as DOMRect)
		divider.setPointerCapture = vi.fn()
		divider.hasPointerCapture = vi.fn(() => true)

		fireEvent.pointerDown(divider, { clientX: 700, pointerId: 1 })
		expect(divider).toHaveAttribute('aria-valuenow', '75')

		fireEvent.pointerMove(divider, { clientX: 100, pointerId: 1 })
		expect(divider).toHaveAttribute('aria-valuenow', '25')

		fireEvent.doubleClick(divider)
		expect(divider).toHaveAttribute('aria-valuenow', '50')
	})
})
