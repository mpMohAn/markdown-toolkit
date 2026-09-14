import type { EditorView } from '@codemirror/view'
import { memo } from 'react'
import { MaterialIcon, type MaterialIconName } from '../../shared/components/MaterialIcon'
import { ToolbarMenu } from '../../shared/components/ToolbarMenu'
import {
	EDITOR_COMMANDS,
	executeEditorCommand,
	type EditorCommandDefinition,
} from './editorCommands'
import { formatMarkdownInEditor } from './markdownFormatter'

const textStyleCommands = EDITOR_COMMANDS.filter(
	(command) => command.id === 'paragraph' || command.id.startsWith('heading'),
)
const formattingCommands = EDITOR_COMMANDS.filter(
	(command) => command.id !== 'paragraph' && !command.id.startsWith('heading'),
)
const commandIcons: Record<string, MaterialIconName> = {
	bold: 'formatBold',
	italic: 'formatItalic',
	strikethrough: 'formatStrikethrough',
	link: 'link',
	image: 'image',
	inlineCode: 'code',
	codeBlock: 'codeBlocks',
	blockquote: 'formatQuote',
	unorderedList: 'formatListBulleted',
	orderedList: 'formatListNumbered',
	taskList: 'checklist',
}

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
	const runTextStyleCommand = (command: EditorCommandDefinition) => {
		if (editorView) executeEditorCommand(editorView, command.id)
	}

	return (
		<div className="editor-toolbar" role="group" aria-label="Markdown formatting">
			<ToolbarMenu
				id="text-style"
				label="Text style"
				disabled={!editorView}
				className="heading-menu"
				menuClassName="heading-menu-popover"
				restoreTriggerFocusOnSelect={false}
				triggerContent={
					<>
						<MaterialIcon name="formatParagraph" />
						<MaterialIcon name="arrowDropDown" className="toolbar-menu-chevron" />
					</>
				}
				items={textStyleCommands.map((command) => ({
					id: command.id,
					label: command.label,
					disabled: !editorView,
					content: (
						<>
							<span className="heading-menu-level">{command.shortLabel}</span>
							<span>{command.label}</span>
						</>
					),
					onSelect: () => runTextStyleCommand(command),
				}))}
			/>

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
							aria-label={command.label}
							title={command.title}
							disabled={!editorView}
							onClick={() =>
								editorView && executeEditorCommand(editorView, command.id)
							}
						>
							<MaterialIcon name={commandIcons[command.id]} />
						</button>
					)
				})}
				<button
					className="toolbar-button toolbar-group-start"
					type="button"
					aria-label="Format Markdown"
					title="Format Markdown"
					disabled={!editorView}
					onClick={() => editorView && formatMarkdownInEditor(editorView)}
				>
					<MaterialIcon name="formatAlignLeft" />
				</button>
				<button
					className="toolbar-button toolbar-group-start"
					type="button"
					aria-label="Toggle line numbers"
					aria-pressed={showLineNumbers}
					title="Toggle line numbers"
					onClick={onToggleLineNumbers}
				>
					<MaterialIcon name="numbers" />
				</button>
			</div>
		</div>
	)
})
