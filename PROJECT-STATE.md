# Markdown Toolkit — Project State

Last updated: 2026-09-02

## Product

Markdown Toolkit is a local-first Markdown editor built with React, Vite, TypeScript, and CodeMirror.

Production: https://markdown-toolkit.pages.dev/

## Architecture

- React + Vite + TypeScript
- CodeMirror editor
- IndexedDB document persistence
- Local-first, browser-only architecture
- Sanitized Markdown preview
- No backend, account system, or cloud sync in V1

## V1 — Complete

- Local persisted document lifecycle
- CodeMirror editor
- Live sanitized GFM preview
- Resizable editor/preview split
- Light/dark theme with persistence
- Optional persisted line numbers
- Markdown formatting toolbar and keyboard shortcuts
- Copy Markdown / Copy HTML
- Download Markdown / Download standalone HTML
- Accessibility, security, and browser-compatibility hardening
- Release metadata, favicons, robots.txt
- Cloudflare Pages deployment

## Repository / Working State

Latest locally reported Codex state before these project-document updates:

- Local branch: `main`
- Local HEAD: `ea44512 feat: add smart markdown autocomplete`
- Nothing staged
- 11 uncommitted files total
  - 4 modified tracked files
  - 7 new AI files

Important: `PROJECT-STATE.md` and `DECISIONS.md` are maintained directly in GitHub as shared project context. The local checkout may therefore be behind remote `main` until those documentation commits are fetched/integrated.

## Smart Markdown Autocomplete

### Implemented

Outside fenced code blocks:

- Heading continuation
- Unordered lists
- Ordered lists with number increment
- Task lists
- Blockquotes
- Nested list indentation
- Learned/repeated heading-pattern inference

Inside fenced code blocks:

- Structural/tree continuation only
- `|--`
- `|----` and longer exact hyphen runs
- `+--`
- `\\--`
- `├──`
- `│   ├──`
- Leading indentation and exact structural prefix are preserved
- `└──` intentionally does not auto-continue

Interaction:

- Tab accepts a visible ghost suggestion
- Escape dismisses it
- Enter does not accept it
- With no suggestion, Tab keeps normal CodeMirror indentation

### Ghost rendering — current uncommitted state

Modified locally:

- `src/features/editor/autocomplete/markdownAutocompleteExtension.ts`
- `src/features/editor/autocomplete/markdownAutocompleteExtension.test.ts`

Current implementation:

- Uses the original CodeMirror `Decoration.widget` / `WidgetType` architecture
- Renders an `aria-hidden` inline `<span>`
- Retains `side: 1` so the suggestion remains semantically after the cursor
- The failed `Decoration.line + ::after` experiment has been completely reverted
- The widget currently inherits `font`, `line-height`, and `letter-spacing`, with baseline styling
- Test coverage additionally confirms that the widget DOM node is a `SPAN`

Current browser status:

- Chrome: real text and ghost text measured with identical geometry
- Firefox: ghost text is on the correct editor line but remains slightly vertically/baseline misaligned
- Firefox geometry has not yet been captured through connected browser-debugging tooling

Investigation findings:

- CodeMirror inserts a zero-width `.cm-widgetBuffer` before a positive-side widget
- CodeMirror adds a trailing `<br>` to preserve the empty editable line
- `side: 0` and `side: -1` moved the buffer after the widget in Chrome but did not change Chrome geometry
- Those side values would also place the widget before the cursor, so no side change was retained
- Current leading hypothesis: Firefox line-box interaction involving `.cm-widgetBuffer`, the non-editable widget span, and the empty-line `<br>`

Do not claim this Firefox hypothesis as confirmed until Firefox geometry is measured or another CodeMirror-native cause is demonstrated.

## Local AI Clean Up POC — uncommitted

The experimental AI Clean Up implementation is currently in the local working tree and has not yet been committed.

New files under `src/features/ai/`:

- `AIProvider.ts`
- `chromeBuiltInAIProvider.ts`
- `markdownCleanup.ts`
- `AICleanup.tsx`
- Three focused AI test files

Related modified tracked files:

- `AppShell.tsx` — adds the AI toolbar control
- `index.css` — review modal, streaming/progress states, responsive layout, and development metrics styling

Implemented behavior:

- Chrome `LanguageModel` capability detection only; no browser sniffing
- No hosted AI, API keys, application inference network calls, new AI SDKs, or new dependencies
- Explicit Enable AI action before local model creation/download
- One reusable warm base session containing static cleanup instructions only
- Fresh cloned session per cleanup to avoid cross-document context contamination
- `promptStreaming()` with throttled progressive rendering
- Original Markdown stays untouched until explicit Apply
- Cancel aborts setup or generation
- Apply uses the existing document update/autosave path
- 40-second inactivity watchdog for stalled model setup
- Advancing `downloadprogress` resets the watchdog
- Unsupported and stalled setup states remain distinct
- Development-only metrics contain timing/count data and never Markdown content

Manual status:

- Chrome: functionally working
- Firefox: Chrome `LanguageModel` API unavailable; editor remains usable
- Arc: model setup can stall; watchdog provides a controlled readiness failure
- POC status: experimental; shipping/commit strategy is still undecided

WebLLM and other cross-browser local-AI fallbacks remain deferred.

## Pending Decisions Before Commit

1. Whether the experimental AI Clean Up POC should ship in the next commit or remain isolated on a POC branch
2. Whether to retain the inherited ghost typography declarations; they are harmless in Chrome but did not solve Firefox
3. How to address Firefox baseline alignment after better Firefox-specific evidence is available
4. Continue deferring the existing Vite >500 kB bundle warning; it predates this browser investigation and has no demonstrated regression tied to the current work

## QA / Validation

Most recent complete reported local validation:

- 21 test files
- 178 tests passed
- Lint passed
- Build passed
- Format check passed
- `git diff --check` passed
- Existing Vite >500 kB JavaScript chunk warning remains

These results cover the current uncommitted implementation as last reported by Codex. They do not replace manual browser acceptance.

## Current Task

Resolve or make an evidence-based decision on the remaining Firefox ghost-text baseline alignment issue without browser sniffing or arbitrary pixel offsets.

Preferred order:

1. Gather trustworthy Firefox-specific evidence if possible
2. Keep the current WidgetType architecture while investigating
3. Prefer the smallest CodeMirror-native fix
4. Keep prediction/autocomplete behavior unchanged
5. Manually verify Firefox and Chrome
6. Only consider a cursor-coordinate overlay if WidgetType cannot be made reliable

Separately, decide whether the AI POC belongs in the next accepted commit or should remain isolated for further experimentation.

## Development Workflow

1. Plan/design the feature or fix first
2. For complex work, review the design twice before implementation
3. Give Codex the implementation prompt only after design is settled
4. Codex implements and runs automated validation
5. Manual testing is performed
6. Fix regressions if needed
7. Commit/push only after manual approval

Do not treat this file as complete historical documentation. Update it whenever an active feature changes state or a major milestone is accepted.
