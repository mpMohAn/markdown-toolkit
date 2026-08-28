import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { Compartment, EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import {
	EditorView,
	highlightActiveLine,
	highlightActiveLineGutter,
	keymap,
	lineNumbers,
	placeholder,
} from '@codemirror/view'
import { memo, useEffect, useRef, useState } from 'react'
import { executeEditorCommand } from './editorCommands'

interface MarkdownEditorProps {
	content: string
	onChange: (content: string) => void
	onReady?: (view: EditorView | null) => void
	showLineNumbers?: boolean
}

export const MarkdownEditor = memo(function MarkdownEditor({
	content,
	onChange,
	onReady,
	showLineNumbers = false,
}: MarkdownEditorProps) {
	const hostRef = useRef<HTMLDivElement>(null)
	const viewRef = useRef<EditorView | null>(null)
	const [initialContent] = useState(content)
	const [initialLineNumbers] = useState(showLineNumbers)
	const [lineNumbersCompartment] = useState(() => new Compartment())

	useEffect(() => {
		const host = hostRef.current

		if (!host) {
			return
		}

		const view = new EditorView({
			parent: host,
			state: EditorState.create({
				doc: initialContent,
				extensions: [
					markdown({ extensions: GFM }),
					lineNumbersCompartment.of(lineNumberExtensions(initialLineNumbers)),
					placeholder('Start writing Markdown…'),
					history(),
					highlightActiveLine(),
					EditorView.lineWrapping,
					keymap.of([
						{ key: 'Mod-b', run: (editor) => executeEditorCommand(editor, 'bold') },
						{ key: 'Mod-i', run: (editor) => executeEditorCommand(editor, 'italic') },
						{ key: 'Mod-k', run: (editor) => executeEditorCommand(editor, 'link') },
						{
							key: 'Mod-Shift-7',
							run: (editor) => executeEditorCommand(editor, 'orderedList'),
						},
						{
							key: 'Mod-Shift-8',
							run: (editor) => executeEditorCommand(editor, 'unorderedList'),
						},
						...defaultKeymap,
						...historyKeymap,
						indentWithTab,
					]),
					EditorView.contentAttributes.of({ 'aria-label': 'Markdown editor' }),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) {
							onChange(update.state.doc.toString())
						}
					}),
					editorTheme,
				],
			}),
		})

		viewRef.current = view
		onReady?.(view)
		view.focus()

		return () => {
			onReady?.(null)
			view.destroy()
			viewRef.current = null
		}
	}, [initialContent, initialLineNumbers, lineNumbersCompartment, onChange, onReady])

	useEffect(() => {
		const view = viewRef.current

		if (!view || content === view.state.doc.toString()) {
			return
		}

		view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } })
	}, [content])

	useEffect(() => {
		const view = viewRef.current
		if (!view) return

		view.dispatch({
			effects: lineNumbersCompartment.reconfigure(lineNumberExtensions(showLineNumbers)),
		})
	}, [lineNumbersCompartment, showLineNumbers])

	return <div className="markdown-editor" ref={hostRef} />
})

function lineNumberExtensions(showLineNumbers: boolean) {
	return showLineNumbers ? [lineNumbers(), highlightActiveLineGutter()] : []
}

const editorTheme = EditorView.theme({
	'&': {
		height: '100%',
		backgroundColor: 'var(--color-editor-surface)',
		color: 'var(--color-text)',
	},
	'.cm-scroller': {
		fontFamily: 'var(--font-mono)',
		fontSize: '0.9375rem',
		lineHeight: '1.7',
		padding: 'var(--pane-padding-block) var(--pane-padding-inline)',
	},
	'.cm-content': {
		caretColor: 'var(--color-text)',
		padding: '0',
	},
	'.cm-line': { padding: '0' },
	'.cm-gutters': {
		border: '0',
		backgroundColor: 'transparent',
		color: 'var(--color-text-muted)',
	},
	'.cm-lineNumbers .cm-gutterElement': {
		minWidth: '2ch',
		padding: '0 var(--space-1) 0 0',
	},
	'.cm-activeLineGutter': {
		backgroundColor: 'transparent',
		color: 'var(--color-text)',
	},
	'.cm-activeLine': { backgroundColor: 'var(--color-active-line)' },
	'.cm-placeholder': {
		color: 'var(--color-text-muted)',
		opacity: '0.72',
	},
	'.cm-cursor, .cm-dropCursor': {
		borderLeftColor: 'var(--color-text-muted)',
		borderLeftWidth: '1px',
	},
	'.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
		backgroundColor: 'var(--color-selection)',
	},
	'&.cm-focused': {
		boxShadow: 'inset 0 0 0 1px var(--color-interaction)',
	},
})
