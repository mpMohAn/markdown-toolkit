import { type CSSProperties, type KeyboardEvent, type PointerEvent, useState } from 'react'
import { MarkdownEditor } from '../editor/MarkdownEditor'
import { MarkdownPreview } from '../preview/MarkdownPreview'

const DEFAULT_SPLIT_PERCENT = 50
const MIN_SPLIT_PERCENT = 25
const MAX_SPLIT_PERCENT = 75
const KEYBOARD_STEP_PERCENT = 2
const SPLIT_STORAGE_KEY = 'markdown-toolkit:workspace-split'

function clampSplit(value: number) {
	return Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, value))
}

function getInitialSplit() {
	if (typeof window === 'undefined') return DEFAULT_SPLIT_PERCENT

	try {
		const storedValue = Number.parseFloat(window.localStorage.getItem(SPLIT_STORAGE_KEY) ?? '')
		return Number.isFinite(storedValue) ? clampSplit(storedValue) : DEFAULT_SPLIT_PERCENT
	} catch {
		return DEFAULT_SPLIT_PERCENT
	}
}

function persistSplit(splitPercent: number) {
	try {
		window.localStorage.setItem(SPLIT_STORAGE_KEY, String(splitPercent))
	} catch {
		// Resizing still works when storage is unavailable or blocked.
	}
}

interface MarkdownWorkspaceProps {
	content: string
	onContentChange: (content: string) => void
}

export function MarkdownWorkspace({ content, onContentChange }: MarkdownWorkspaceProps) {
	const [splitPercent, setSplitPercent] = useState(getInitialSplit)

	const updateSplit = (nextSplit: number) => {
		const clampedSplit = clampSplit(nextSplit)
		setSplitPercent(clampedSplit)
		persistSplit(clampedSplit)
	}

	const updateSplitFromPointer = (event: PointerEvent<HTMLDivElement>) => {
		const workspace = event.currentTarget.parentElement
		if (!workspace) return

		const bounds = workspace.getBoundingClientRect()
		if (bounds.width === 0) return

		updateSplit(((event.clientX - bounds.left) / bounds.width) * 100)
	}

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		event.currentTarget.setPointerCapture(event.pointerId)
		updateSplitFromPointer(event)
	}

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			updateSplitFromPointer(event)
		}
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

		event.preventDefault()
		updateSplit(
			splitPercent +
				(event.key === 'ArrowLeft' ? -KEYBOARD_STEP_PERCENT : KEYBOARD_STEP_PERCENT),
		)
	}

	const workspaceStyle = {
		'--workspace-split': `${splitPercent}%`,
	} as CSSProperties

	return (
		<section
			className="markdown-workspace"
			aria-label="Markdown workspace"
			style={workspaceStyle}
		>
			<section className="workspace-pane editor-pane" aria-label="Markdown editor">
				<MarkdownEditor content={content} onChange={onContentChange} />
			</section>
			<div
				className="workspace-divider"
				role="separator"
				aria-label="Resize editor and preview"
				aria-orientation="vertical"
				aria-valuemin={MIN_SPLIT_PERCENT}
				aria-valuemax={MAX_SPLIT_PERCENT}
				aria-valuenow={Math.round(splitPercent)}
				tabIndex={0}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onKeyDown={handleKeyDown}
				onDoubleClick={() => updateSplit(DEFAULT_SPLIT_PERCENT)}
			/>
			<section className="workspace-pane preview-pane">
				<MarkdownPreview content={content} />
			</section>
		</section>
	)
}
