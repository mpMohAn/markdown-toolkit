import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { GFM } from '@lezer/markdown'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { useEffect, useRef, useState } from 'react'

interface MarkdownEditorProps {
	content: string
	onChange: (content: string) => void
}

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
	const hostRef = useRef<HTMLDivElement>(null)
	const viewRef = useRef<EditorView | null>(null)
	const [initialContent] = useState(content)

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
					placeholder('Start writing Markdown…'),
					history(),
					EditorView.lineWrapping,
					keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
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
		view.focus()

		return () => {
			view.destroy()
			viewRef.current = null
		}
	}, [initialContent, onChange])

	useEffect(() => {
		const view = viewRef.current

		if (!view || content === view.state.doc.toString()) {
			return
		}

		view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: content } })
	}, [content])

	return <div className="markdown-editor" ref={hostRef} />
}

const editorTheme = EditorView.theme({
	'&': {
		height: '100%',
		backgroundColor: 'var(--color-surface)',
		color: 'var(--color-text)',
	},
	'.cm-scroller': {
		fontFamily: 'var(--font-mono)',
		fontSize: '0.9375rem',
		lineHeight: '1.65',
		padding: 'var(--space-5)',
	},
	'.cm-content': { caretColor: 'var(--color-accent)' },
	'.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-accent)' },
	'.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
		backgroundColor: 'var(--color-selection)',
	},
	'&.cm-focused': {
		boxShadow: 'inset 0 0 0 1px var(--color-focus)',
	},
})
