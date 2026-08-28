import { type CSSProperties, type KeyboardEvent, type PointerEvent, useState } from 'react'
import type { EditorView } from '@codemirror/view'
import { MarkdownEditor } from '../editor/MarkdownEditor'
import { MarkdownPreview } from '../preview/MarkdownPreview'
import {
	clampSplit,
	DEFAULT_SPLIT_PERCENT,
	MAX_SPLIT_PERCENT,
	MIN_SPLIT_PERCENT,
	readSplitPercent,
	writeSplitPercent,
} from './workspacePreferences'

const KEYBOARD_STEP_PERCENT = 2

interface MarkdownWorkspaceProps {
	content: string
	onContentChange: (content: string) => void
	onEditorReady?: (view: EditorView | null) => void
	showLineNumbers?: boolean
}

export function MarkdownWorkspace({
	content,
	onContentChange,
	onEditorReady,
	showLineNumbers = false,
}: MarkdownWorkspaceProps) {
	const [splitPercent, setSplitPercent] = useState(readSplitPercent)

	const updateSplit = (nextSplit: number) => {
		const clampedSplit = clampSplit(nextSplit)
		setSplitPercent(clampedSplit)
		writeSplitPercent(clampedSplit)
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

	const releasePointer = (event: PointerEvent<HTMLDivElement>) => {
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId)
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
				<MarkdownEditor
					content={content}
					onChange={onContentChange}
					onReady={onEditorReady}
					showLineNumbers={showLineNumbers}
				/>
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
				onPointerUp={releasePointer}
				onPointerCancel={releasePointer}
				onKeyDown={handleKeyDown}
				onDoubleClick={() => updateSplit(DEFAULT_SPLIT_PERCENT)}
			/>
			<section className="workspace-pane preview-pane">
				<MarkdownPreview content={content} />
			</section>
		</section>
	)
}
