import type { MermaidBlock } from './markdownRenderer'

export type PreviewTheme = 'light' | 'dark'

interface MermaidApi {
	initialize(configuration: Record<string, unknown>): void
	parse(source: string, options: { suppressErrors: true }): Promise<unknown | false>
	render(id: string, source: string, container: HTMLElement): Promise<{ svg: string }>
}

export type MermaidLoader = () => Promise<{ default: MermaidApi }>

const loadMermaid: MermaidLoader = () => import('mermaid')

export async function renderMermaidBlocks({
	root,
	blocks,
	theme,
	isCurrent,
	onTemporaryNode,
	loader = loadMermaid,
}: {
	root: HTMLElement
	blocks: MermaidBlock[]
	theme: PreviewTheme
	isCurrent: () => boolean
	onTemporaryNode?: (node: HTMLElement) => void
	loader?: MermaidLoader
}): Promise<void> {
	if (blocks.length === 0 || !isCurrent()) return

	let mermaid: MermaidApi
	try {
		;({ default: mermaid } = await loader())
	} catch {
		if (isCurrent()) showControlledErrors(root)
		return
	}
	if (!isCurrent()) return
	mermaid.initialize({
		startOnLoad: false,
		securityLevel: 'strict',
		htmlLabels: false,
		theme: theme === 'dark' ? 'dark' : 'default',
		secure: ['secure', 'securityLevel', 'startOnLoad', 'maxTextSize'],
		suppressErrorRendering: true,
	})

	const containers = new Map(
		Array.from(root.querySelectorAll<HTMLElement>('[data-mermaid-id]')).map((element) => [
			element.dataset.mermaidId,
			element,
		]),
	)

	await Promise.all(
		blocks.map(async (block) => {
			const container = containers.get(block.id)
			if (!container) return
			try {
				const valid = await mermaid.parse(block.source, { suppressErrors: true })
				if (!valid) throw new Error('Invalid Mermaid source')
				if (!isCurrent() || !container.isConnected) return

				const temporaryHost = document.createElement('div')
				temporaryHost.dataset.mermaidRenderOwner = block.id
				container.append(temporaryHost)
				onTemporaryNode?.(temporaryHost)
				try {
					const renderId = `${block.id}-render-${nextRenderIdentity()}`
					const { svg } = await mermaid.render(renderId, block.source, temporaryHost)
					if (!isCurrent() || !container.isConnected) return
					const safeSvg = sanitizeMermaidSvg(svg)
					if (!safeSvg) throw new Error('Invalid Mermaid SVG')
					container.replaceChildren()
					container.insertAdjacentHTML('afterbegin', safeSvg)
					container.classList.remove('mermaid-diagram--error')
					container.setAttribute('role', 'img')
				} finally {
					temporaryHost.remove()
				}
			} catch {
				if (!isCurrent() || !container.isConnected) return
				container.replaceChildren('Unable to render Mermaid diagram.')
				container.classList.add('mermaid-diagram--error')
				container.setAttribute('role', 'alert')
			}
		}),
	)
}

let renderIdentity = 0

function nextRenderIdentity(): number {
	renderIdentity += 1
	return renderIdentity
}

function showControlledErrors(root: HTMLElement) {
	for (const container of root.querySelectorAll<HTMLElement>('[data-mermaid-id]')) {
		container.replaceChildren('Unable to render Mermaid diagram.')
		container.classList.add('mermaid-diagram--error')
		container.setAttribute('role', 'alert')
	}
}

export function sanitizeMermaidSvg(svg: string): string | null {
	const documentNode = new DOMParser().parseFromString(svg, 'image/svg+xml')
	const root = documentNode.documentElement
	if (root.localName !== 'svg' || documentNode.querySelector('parsererror')) return null

	for (const element of Array.from(
		documentNode.querySelectorAll('script, foreignObject, iframe, object, embed'),
	)) {
		element.remove()
	}
	for (const element of Array.from(documentNode.querySelectorAll('*'))) {
		for (const attribute of Array.from(element.attributes)) {
			const name = attribute.name.toLowerCase()
			const value = attribute.value.trim().toLowerCase()
			if (
				name.startsWith('on') ||
				name === 'tabindex' ||
				name === 'focusable' ||
				((name === 'href' || name === 'xlink:href') && !value.startsWith('#'))
			) {
				element.removeAttribute(attribute.name)
			}
		}
	}
	for (const link of Array.from(documentNode.querySelectorAll('a')))
		link.replaceWith(...link.childNodes)

	root.setAttribute('aria-hidden', 'true')
	root.setAttribute('focusable', 'false')
	root.removeAttribute('role')
	return new XMLSerializer().serializeToString(root)
}
