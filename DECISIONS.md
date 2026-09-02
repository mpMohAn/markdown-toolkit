# Markdown Toolkit — Decisions

This file records durable product, architecture, UX, and engineering decisions so future work does not accidentally repeat rejected approaches.

## Product Direction

- Markdown Toolkit is a tool-first, local-first Markdown editor.
- V1 is browser-only and does not require accounts, authentication, a backend, or cloud sync.
- Desktop is the primary experience. Mobile should remain functional but is not the main design target.
- The product may eventually be part of a broader collection of useful free web tools.

## UX Direction

- Content first, controls second.
- Compact IDE/tool-style interface rather than a marketing-style application shell.
- No permanent product-title/header inside the editor workspace.
- No giant outer card around the editor.
- Neutral visual hierarchy; avoid unnecessary bright blue/cyan emphasis.
- Toolbar and status areas should remain compact.
- Accessibility and usable hit/focus targets must not be sacrificed for compactness.

## Editor / Markdown

- CodeMirror is the editor foundation.
- Standard Markdown semantics should be preserved rather than inventing renderer-specific behavior.
- Single Markdown source newlines are allowed to render as part of the same paragraph according to normal Markdown behavior.
- Folder/tree structures that require preserved line breaks belong naturally in fenced code blocks.
- Line numbers are optional and persisted locally.

## Persistence

- IndexedDB is the document persistence layer.
- Active V1 document ID: `active-document`.
- React components should not depend directly on IndexedDB implementation details.
- Autosave is local and debounced.

## Markdown Autocomplete

### Outside fenced code blocks

Use Markdown-aware deterministic continuation, including headings, lists, tasks, ordered lists, blockquotes, and conservative learned heading patterns.

### Inside fenced code blocks

Only structural/tree continuation is allowed.

Supported structural families include:

- `|--`
- longer exact `|----`-style prefixes
- `+--`
- `\\--`
- `├──`
- nested prefixes such as `│   ├──`

Preserve indentation and the exact structural prefix from the previous eligible line.

### Terminal branch

- `└──` does not automatically continue because it conventionally represents the final sibling.
- Do not guess when `├──` should become `└──`.

### Interaction

- Tab accepts a visible ghost suggestion.
- If no ghost exists, Tab retains normal CodeMirror behavior.
- Escape dismisses the suggestion.
- Enter does not accept autocomplete.

### Ghost rendering architecture

- The current preferred implementation remains CodeMirror `Decoration.widget` / `WidgetType`.
- The ghost is an inline `aria-hidden` span.
- Keep `side: 1` unless new evidence demonstrates a CodeMirror-native reason to change it. This keeps the suggestion semantically after the cursor.
- Chrome investigation showed `side: 0` and `side: -1` changed `.cm-widgetBuffer` placement but did not improve geometry and would place the widget before the cursor.
- Do not change widget `side` merely to rearrange the buffer without demonstrated rendering benefit.

### Rejected ghost-rendering approach

`Decoration.line(...)` plus `.cm-line::after` was tested for ghost rendering and rejected.

Reason:

- It caused the ghost to appear on a separate visual line in both Chrome and Firefox.
- It was worse than the existing `Decoration.widget` / `WidgetType` implementation.

Do not reintroduce this approach without a new design review and evidence that the underlying problem has changed.

### Ghost alignment constraints

Do not solve browser alignment with:

- browser/user-agent sniffing
- `@-moz-document`
- arbitrary `top` offsets
- `translateY(...)`
- negative margins
- browser-specific magic pixels

Prefer CodeMirror-native behavior and measured geometry. A cursor-coordinate overlay may be considered only if WidgetType cannot be made reliable.

Current Firefox line-box explanation involving `.cm-widgetBuffer`, the non-editable widget span, and the empty-line `<br>` is a hypothesis, not a confirmed root cause. Chrome-only geometry must not be presented as proof of Firefox behavior.

## Local AI

- AI is an optional enhancement; the Markdown editor must remain fully functional without it.
- The first POC uses Chrome's built-in local `LanguageModel` Prompt API.
- No hosted AI API, backend inference, API keys, WebLLM, or Transformers.js for the initial POC.
- WebLLM remains a possible future cross-browser fallback.
- AI must never automatically overwrite Markdown.
- Users review Original vs Suggestion and explicitly Apply or Cancel.
- Local model download/setup must begin from explicit user action rather than silently on page load.
- AI failures must preserve the original document.
- Do not browser-sniff for Chrome, Firefox, Arc, or Chromium. Use capability/state detection.
- The current AI Clean Up implementation remains explicitly a POC until its shipping/commit strategy is deliberately accepted.

### AI session isolation

- Maintain a reusable warm base session containing only static cleanup instructions.
- Never put document content into the reusable base session.
- Clone the base session for each cleanup operation.
- Destroy the task clone afterward.
- This avoids cross-document conversational context contamination while reducing repeated cold setup.

### AI streaming and application

- Use `promptStreaming()` for progressive local output when supported by the chosen provider implementation.
- Throttle UI updates rather than mutating React state for every tiny stream event.
- Streaming output belongs in the review experience, not directly in CodeMirror.
- Applying a completed suggestion must use the existing document update/autosave path.
- Cancel must leave the original Markdown unchanged.

### AI setup behavior

- Distinguish unsupported from present-but-stalled setup.
- Model setup has a 40-second inactivity watchdog; advancing download progress resets it.
- Retry starts fresh setup state rather than relying on a stale aborted setup.
- Do not use a fake inference percentage.
- Do not apply a short timeout to legitimate inference simply because generation is slow.

### AI development metrics

Development-only AI diagnostics may include timing, availability/session state, character counts, context usage/window where available, and result status. They must never contain the user's Markdown/document content.

## Security / Privacy

- Markdown content stays local for V1.
- Sanitized preview/copy/download should use a consistent rendering/sanitization pipeline.
- Remote images embedded by the user may still cause the browser to make requests to their remote URLs; this is documented rather than hidden.
- AI POC must not send Markdown to hosted inference services.

## Performance

- Avoid unnecessary dependencies.
- Preserve CodeMirror instances where practical rather than recreating them for preference changes.
- Preview work may be deferred to keep editing responsive.
- The existing >500 kB Vite bundle warning is known and accepted for V1; do not restructure chunks merely to hide the warning without an actual performance benefit.
- The existing bundle warning predates the current ghost-rendering investigation and should not be treated as a regression without measured evidence.

## Browser Strategy

- Current Chrome, Safari, and Firefox desktop are the main editor compatibility targets.
- Chrome built-in AI support is an enhancement and does not define general editor browser support.
- Browser-specific fixes should be avoided unless a standards-based or library-native solution is genuinely impossible and the behavior is demonstrated.
- When connected browser tooling cannot inspect a target browser, clearly distinguish measured results from manual observations; do not fabricate cross-browser geometry.

## Deployment

- Production is deployed with Cloudflare Pages.
- Production branch is `main`.
- Build command: `npm run build`.
- Build output directory: `dist`.

## Development Workflow

- Plan/design before implementation.
- Complex changes receive a second design review before a Codex prompt is provided.
- Codex implements and runs automated checks.
- Manual testing happens before commit/push approval.
- Do not commit/push experimental work merely because automated tests pass.
- GitHub project-state documentation may be ahead of the developer's local checkout; local Codex should check/fetch remote state before making assumptions about HEAD.

## Deferred / Future Work

Deferred beyond V1 or the current POC includes:

- WebLLM/local-AI fallback
- broader AI rewrite/grammar/summarization features
- AI inline sentence completion
- PDF/DOCX export
- accounts/authentication
- cloud sync
- multiple documents/workspaces
- collaboration
- GitHub integration inside the product
- command palette
- synchronized editor/preview scrolling

Update this file when a durable decision changes. Do not use it as a temporary task log; temporary/current status belongs in `PROJECT-STATE.md`.
