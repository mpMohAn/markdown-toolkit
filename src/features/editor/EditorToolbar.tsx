import type { EditorView } from '@codemirror/view'
import { memo, useRef, useState } from 'react'
import { handleToolbarMenuKeyDown } from '../../shared/components/toolbarMenuKeyboard'
import {
	EDITOR_COMMANDS,
	executeEditorCommand,
	type EditorCommandDefinition,
} from './editorCommands'

const headingCommands = EDITOR_COMMANDS.filter((command) => command.id.startsWith('heading'))
const formattingCommands = EDITOR_COMMANDS.filter((command) => !command.id.startsWith('heading'))

interface EditorToolbarProps {
	editorView: EditorView | null
	showLineNumbers: boolean
	onToggleLineNumbers: () => void
}

export const EditorToolbar = memo(function EditorToolbar({
	editorView,
	showLineNumbers,
	onToggleLineNumbers,
}: EditorToolbarProps) {
	const [headingMenuOpen, setHeadingMenuOpen] = useState(false)
	const headingTriggerRef = useRef<HTMLElement>(null)
	const runHeadingCommand = (
		command: EditorCommandDefinition,
		details: HTMLDetailsElement | null,
	) => {
		if (!editorView) return

		setHeadingMenuOpen(false)
		details?.removeAttribute('open')
		executeEditorCommand(editorView, command.id)
	}

	return (
		<div className="editor-toolbar" role="group" aria-label="Markdown formatting">
			<details
				className={`toolbar-menu heading-menu${editorView ? '' : ' is-disabled'}`}
				name="markdown-toolbar-menu"
				open={headingMenuOpen}
				onToggle={(event) => setHeadingMenuOpen(event.currentTarget.open)}
				onKeyDown={(event) =>
					handleToolbarMenuKeyDown({
						event,
						setOpen: setHeadingMenuOpen,
						triggerRef: headingTriggerRef,
					})
				}
			>
				<summary
					ref={headingTriggerRef}
					className="toolbar-menu-trigger heading-menu-trigger"
					role="button"
					aria-label="Heading"
					aria-disabled={!editorView}
					aria-expanded={headingMenuOpen}
					aria-haspopup="menu"
					title="Heading"
					onClick={(event) => {
						if (!editorView) event.preventDefault()
					}}
				>
					<span aria-hidden="true">H⌄</span>
				</summary>
				<div className="toolbar-menu-popover heading-menu-popover" role="menu">
					{headingCommands.map((command, index) => (
						<button
							type="button"
							role="menuitem"
							key={command.id}
							aria-label={`H${index + 1} Heading ${index + 1}`}
							disabled={!editorView}
							onClick={(event) =>
								runHeadingCommand(command, event.currentTarget.closest('details'))
							}
						>
							<span className="heading-menu-level">H{index + 1}</span>
							<span>Heading {index + 1}</span>
						</button>
					))}
				</div>
			</details>

			<div className="formatting-controls">
				{formattingCommands.map((command, index) => {
					const previousCommand = formattingCommands[index - 1]
					const startsGroup = previousCommand && previousCommand.group !== command.group

					return (
						<button
							className={`toolbar-button${startsGroup ? ' toolbar-group-start' : ''}`}
							type="button"
							key={command.id}
							data-command={command.id}
							aria-label={
								command.id === 'orderedList' ? `1. ${command.label}` : command.label
							}
							title={command.title}
							disabled={!editorView}
							onClick={() =>
								editorView && executeEditorCommand(editorView, command.id)
							}
						>
							<span aria-hidden="true">{command.symbol}</span>
						</button>
					)
				})}
				<button
					className="toolbar-button toolbar-group-start"
					type="button"
					aria-label="Toggle line numbers"
					aria-pressed={showLineNumbers}
					title="Toggle line numbers"
					onClick={onToggleLineNumbers}
				>
					<span aria-hidden="true">№</span>
				</button>
			</div>
		</div>
	)
})
