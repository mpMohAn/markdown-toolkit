import { act, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { MermaidLoader } from './mermaidRenderer'
import { MarkdownPreview } from './MarkdownPreview'

function deferred<T>() {
	let resolve!: (value: T) => void
	const promise = new Promise<T>((resolver) => {
		resolve = resolver
	})
	return { promise, resolve }
}

function loaderWith(
	render: (id: string, source: string, container: HTMLElement) => Promise<{ svg: string }>,
	parse: (source: string, options: { suppressErrors: true }) => Promise<unknown | false> = vi.fn(
		async () => ({ diagramType: 'flowchart-v2' }),
	),
) {
	const initialize = vi.fn()
	const loader: MermaidLoader = vi.fn(async () => ({
		default: { initialize, parse, render },
	}))
	return { initialize, loader, parse }
}

describe('MarkdownPreview', () => {
	it('renders an accessible empty state', () => {
		render(<MarkdownPreview content="" />)

		expect(screen.getByText('Start writing Markdown…')).toBeInTheDocument()
	})

	it('treats a whitespace-only document as empty', () => {
		render(<MarkdownPreview content={' \n\t '} />)

		expect(screen.getByText('Start writing Markdown…')).toBeInTheDocument()
	})

	it('renders Markdown content', () => {
		render(<MarkdownPreview content="# Hello" />)

		expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument()
	})

	it('does not load Mermaid for documents without Mermaid fences', () => {
		const { loader } = loaderWith(vi.fn())
		render(<MarkdownPreview content="# Hello" mermaidLoader={loader} />)

		expect(loader).not.toHaveBeenCalled()
	})

	it('renders complete diagrams with strict theme configuration and sanitized SVG', async () => {
		const renderDiagram = vi.fn(async () => ({
			svg: '<svg tabindex="0"><script>alert(1)</script><a href="https://bad.test"><text>Diagram</text></a></svg>',
		}))
		const { initialize, loader } = loaderWith(renderDiagram)
		const { container, rerender } = render(
			<MarkdownPreview
				content={'```mermaid\nflowchart TD\n A --> B\n```'}
				theme="light"
				mermaidLoader={loader}
			/>,
		)

		await waitFor(() => expect(container.querySelector('svg')).not.toBeNull())
		expect(container.innerHTML).not.toContain('<script')
		expect(container.innerHTML).not.toContain('href=')
		expect(container.innerHTML).not.toContain('tabindex=')
		expect(initialize).toHaveBeenCalledWith(
			expect.objectContaining({
				securityLevel: 'strict',
				htmlLabels: false,
				theme: 'default',
			}),
		)

		rerender(
			<MarkdownPreview
				content={'```mermaid\nflowchart TD\n A --> B\n```'}
				theme="dark"
				mermaidLoader={loader}
			/>,
		)
		await waitFor(() =>
			expect(initialize).toHaveBeenLastCalledWith(expect.objectContaining({ theme: 'dark' })),
		)
	})

	it('shows a controlled accessible error for invalid diagrams', async () => {
		const renderDiagram = vi.fn(async () => ({
			svg: '<svg><text>Syntax error in text mermaid version 12.0.0</text></svg>',
		}))
		const { loader, parse } = loaderWith(
			renderDiagram,
			vi.fn(async () => false),
		)
		const { container } = render(
			<>
				<MarkdownPreview content={'```mermaid\nnot valid\n```'} mermaidLoader={loader} />
				<footer>Saved</footer>
			</>,
		)

		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Unable to render Mermaid diagram.',
		)
		expect(parse).toHaveBeenCalledWith('not valid\n', { suppressErrors: true })
		expect(renderDiagram).not.toHaveBeenCalled()
		expect(container).not.toHaveTextContent('Syntax error in text')
		expect(document.body).not.toHaveTextContent('mermaid version')
		expect(document.body.querySelectorAll('[data-mermaid-render-owner]')).toHaveLength(0)
		expect(screen.getByText('Saved').tagName).toBe('FOOTER')
	})

	it('does not accumulate temporary output across repeated invalid renders', async () => {
		const { loader } = loaderWith(
			vi.fn(),
			vi.fn(async () => false),
		)
		const view = render(
			<MarkdownPreview content={'```mermaid\ninvalid one\n```'} mermaidLoader={loader} />,
		)
		await screen.findByRole('alert')

		view.rerender(
			<MarkdownPreview content={'```mermaid\ninvalid two\n```'} mermaidLoader={loader} />,
		)
		await waitFor(() => expect(screen.getAllByRole('alert')).toHaveLength(1))
		expect(document.body.querySelectorAll('[data-mermaid-render-owner]')).toHaveLength(0)
	})

	it('recovers from an invalid diagram and isolates later invalid output', async () => {
		const parse = vi
			.fn()
			.mockResolvedValueOnce(false)
			.mockResolvedValueOnce({ diagramType: 'flowchart-v2' })
			.mockResolvedValueOnce(false)
		const renderDiagram = vi.fn(async (_id, _source, host: HTMLElement) => {
			host.append(document.createElement('svg'))
			return { svg: '<svg><text>Valid diagram</text></svg>' }
		})
		const { loader } = loaderWith(renderDiagram, parse)
		const view = render(
			<MarkdownPreview content={'```mermaid\ninvalid\n```'} mermaidLoader={loader} />,
		)
		await screen.findByRole('alert')

		view.rerender(
			<MarkdownPreview
				content={'```mermaid\nflowchart TD\n A --> B\n```'}
				mermaidLoader={loader}
			/>,
		)
		expect(await screen.findByText('Valid diagram')).toBeInTheDocument()
		expect(document.body.querySelectorAll('[data-mermaid-render-owner]')).toHaveLength(0)

		view.rerender(
			<MarkdownPreview content={'```mermaid\ninvalid again\n```'} mermaidLoader={loader} />,
		)
		expect(await screen.findByRole('alert')).toHaveTextContent(
			'Unable to render Mermaid diagram.',
		)
		expect(screen.queryByText('Valid diagram')).not.toBeInTheDocument()
	})

	it('keeps multiple Mermaid blocks and their temporary hosts isolated', async () => {
		const renderDiagram = vi.fn(async (id: string, _source: string, host: HTMLElement) => {
			expect(host.dataset.mermaidRenderOwner).toBeTruthy()
			return { svg: `<svg><text>${id}</text></svg>` }
		})
		const { loader } = loaderWith(renderDiagram)
		render(
			<MarkdownPreview
				content={
					'```mermaid\nflowchart TD\n A --> B\n```\n\n```mermaid\nflowchart TD\n C --> D\n```'
				}
				mermaidLoader={loader}
			/>,
		)

		await waitFor(() => expect(renderDiagram).toHaveBeenCalledTimes(2))
		expect(document.querySelectorAll('.mermaid-diagram svg')).toHaveLength(2)
		expect(document.body.querySelectorAll('[data-mermaid-render-owner]')).toHaveLength(0)
	})

	it('ignores stale asynchronous diagram output after content changes', async () => {
		const first = deferred<{ svg: string }>()
		const renderDiagram = vi
			.fn()
			.mockImplementationOnce(() => first.promise)
			.mockResolvedValueOnce({ svg: '<svg><text>Current</text></svg>' })
		const { loader } = loaderWith(renderDiagram)
		const { container, rerender } = render(
			<MarkdownPreview
				content={'```mermaid\nflowchart TD\n A --> B\n```'}
				mermaidLoader={loader}
			/>,
		)

		await waitFor(() => expect(renderDiagram).toHaveBeenCalledTimes(1))
		rerender(
			<MarkdownPreview
				content={'```mermaid\nflowchart TD\n C --> D\n```'}
				mermaidLoader={loader}
			/>,
		)
		await waitFor(() => expect(container).toHaveTextContent('Current'))

		await act(async () => first.resolve({ svg: '<svg><text>Stale</text></svg>' }))
		expect(container).not.toHaveTextContent('Stale')
		expect(document.body.querySelectorAll('[data-mermaid-render-owner]')).toHaveLength(0)
	})

	it('removes an active render host when the preview unmounts', async () => {
		const pending = deferred<{ svg: string }>()
		const { loader } = loaderWith(vi.fn(() => pending.promise))
		const view = render(
			<MarkdownPreview
				content={'```mermaid\nflowchart TD\n A --> B\n```'}
				mermaidLoader={loader}
			/>,
		)

		await waitFor(() =>
			expect(document.body.querySelectorAll('[data-mermaid-render-owner]')).toHaveLength(1),
		)
		view.unmount()
		expect(document.body.querySelectorAll('[data-mermaid-render-owner]')).toHaveLength(0)
		await act(async () => pending.resolve({ svg: '<svg><text>Late</text></svg>' }))
		expect(document.body).not.toHaveTextContent('Late')
	})
})
