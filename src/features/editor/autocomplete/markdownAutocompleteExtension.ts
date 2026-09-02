import { EditorSelection, Prec, type Extension } from '@codemirror/state'
import {
	Decoration,
	type DecorationSet,
	EditorView,
	keymap,
	ViewPlugin,
	type ViewUpdate,
	WidgetType,
} from '@codemirror/view'
import { getMarkdownContinuation, type MarkdownContinuation } from './markdownAutocomplete'

interface ActiveSuggestion extends MarkdownContinuation {
	from: number
}

class GhostTextWidget extends WidgetType {
	readonly text: string

	constructor(text: string) {
		super()
		this.text = text
	}

	eq(widget: GhostTextWidget) {
		return widget.text === this.text
	}

	toDOM() {
		const ghost = document.createElement('span')
		ghost.className = 'cm-markdown-autocomplete-ghost'
		ghost.setAttribute('aria-hidden', 'true')
		ghost.textContent = this.text
		return ghost
	}

	ignoreEvent() {
		return true
	}
}

class MarkdownAutocompleteView {
	decorations: DecorationSet = Decoration.none
	private activeSuggestion: ActiveSuggestion | null = null
	private dismissedSignature: string | null = null

	constructor(view: EditorView) {
		this.recompute(view)
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.selectionSet) {
			this.dismissedSignature = null
		}

		this.recompute(update.view)
	}

	get suggestion() {
		return this.activeSuggestion
	}

	dismiss(view: EditorView) {
		if (!this.activeSuggestion) return false

		this.dismissedSignature = suggestionSignature(this.activeSuggestion)
		this.recompute(view)
		view.dispatch({})
		return true
	}

	private recompute(view: EditorView) {
		const selection = view.state.selection
		const range = selection.main
		const continuation =
			view.hasFocus &&
			selection.ranges.length === 1 &&
			!view.dom.querySelector('.cm-tooltip-autocomplete') &&
			shouldAnalyzeNearbyLines(view)
				? getMarkdownContinuation({
						documentText: view.state.doc.toString(),
						cursorOffset: range.head,
						selectionFrom: range.from,
						selectionTo: range.to,
					})
				: null
		const suggestion = continuation ? { ...continuation, from: range.head } : null

		this.activeSuggestion =
			suggestion && suggestionSignature(suggestion) !== this.dismissedSignature
				? suggestion
				: null
		this.decorations = this.activeSuggestion
			? Decoration.set([
					Decoration.widget({
						widget: new GhostTextWidget(this.activeSuggestion.text),
						side: 1,
					}).range(this.activeSuggestion.from),
				])
			: Decoration.none
	}
}

function shouldAnalyzeNearbyLines(view: EditorView) {
	const range = view.state.selection.main
	if (!range.empty) return false

	const line = view.state.doc.lineAt(range.head)
	if (range.head !== line.to || line.number === 1 || !/^\s*$/.test(line.text)) return false
	return true
}

const markdownAutocompletePlugin = ViewPlugin.fromClass(MarkdownAutocompleteView, {
	decorations: (value) => value.decorations,
})

export function acceptMarkdownContinuation(view: EditorView): boolean {
	const suggestion = view.plugin(markdownAutocompletePlugin)?.suggestion
	if (!suggestion) return false

	const cursor = suggestion.from + suggestion.text.length
	view.dispatch({
		changes: { from: suggestion.from, insert: suggestion.text },
		selection: EditorSelection.cursor(cursor),
		userEvent: 'input.complete',
	})
	return true
}

export function dismissMarkdownContinuation(view: EditorView): boolean {
	return view.plugin(markdownAutocompletePlugin)?.dismiss(view) ?? false
}

export function markdownAutocomplete(): Extension {
	return [
		markdownAutocompletePlugin,
		Prec.highest(
			keymap.of([
				{ key: 'Tab', run: acceptMarkdownContinuation },
				{ key: 'Escape', run: dismissMarkdownContinuation },
			]),
		),
		EditorView.baseTheme({
			'.cm-markdown-autocomplete-ghost': {
				display: 'inline',
				font: 'inherit',
				lineHeight: 'inherit',
				letterSpacing: 'inherit',
				verticalAlign: 'baseline',
				color: 'var(--color-text-muted)',
				opacity: '0.48',
				pointerEvents: 'none',
			},
		}),
	]
}

function suggestionSignature(suggestion: ActiveSuggestion) {
	return `${suggestion.from}:${suggestion.type}:${suggestion.text}`
}
