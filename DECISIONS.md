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
- The application toolbar uses three stable regions: brand and formatting on the left, the document filename independently centred relative to the window, and document/application actions on the right.
- The right action order is Copy, Download, AI writing, then Theme. The filename truncates or hides before essential controls are removed.
- The approved compact Markdown Toolkit favicon asset is reused as the toolbar brand; reference-project names, logos, fonts, and utility CSS are not runtime dependencies.
- Toolbar controls use only individually selected Google Material SVG files bundled under `src/assets/icons/material/` and rendered as current-colour masks. Runtime Google Fonts, icon fonts, icon CDNs, and full icon libraries are prohibited.
- Text style, Copy, Download, and future toolbar menus share one accessible menu primitive: a single menu may be open, native button triggers expose menu state, arrow/Home/End/Escape behavior is supported, Tab closes naturally, and outside listeners are cleaned up.
- Product information, privacy, repository, issue reporting, and optional GitHub Sponsors support are grouped under one compact About menu. Support is not a permanent primary toolbar action because editing controls remain the product's visual priority.
- About and Privacy use accessible modal behavior with initial Close focus, focus containment, inert background content, Escape/backdrop closure, and trigger-focus restoration.

## Editor / Markdown

- CodeMirror is the editor foundation.
- Standard Markdown semantics should be preserved rather than inventing renderer-specific behavior.
- Single Markdown source newlines are allowed to render as part of the same paragraph according to normal Markdown behavior.
- Folder/tree structures that require preserved line breaks belong naturally in fenced code blocks.
- Line numbers are optional and persisted locally.
- Paragraph plus H1–H6 share the existing editor-command layer; Paragraph removes an ATX heading marker without changing unrelated block syntax.
- CodeMirror assigns one shared semantic colour to H1–H6 syntax in the editor only. Preview heading presentation remains independent.
- The shared editor heading token must meet WCAG AA contrast against the actual theme editor surface; the gutter uses CodeMirror styling and a semantic right-gap token rather than document text spacing.
- Header bottom, footer top, and split boundaries use `--color-workspace-border`. Each structural seam has one border owner; editor and preview panes do not add adjacent desktop split borders.
- Editor focus does not change pane borders or surface colours. The caret, selection, and active-line treatment provide editor-state feedback; the keyboard splitter retains its own focus-visible treatment.
- Image formatting follows the Link command pattern through the shared editor command layer and inserts Markdown image syntax only. It does not upload, select, paste, or fetch image files.
- Format Markdown is deterministic, synchronous, local-only, and independent of AI capability. It conservatively normalizes Markdown outside fenced code and applies through one CodeMirror transaction.

## Synchronized Scrolling

- Synchronized editor/preview scrolling is rejected and removed because anchor-based, bidirectional, and proportional experiments did not remain reliable as editor wrapping and preview geometry changed.
- Editor and preview scroll independently. Do not add another synchronization implementation unless a future design demonstrates reliable behavior through manual acceptance.

## Document Identity

- The first valid ATX H1 outside fenced code and HTML comments supplies document identity.
- Inline Markdown is converted to readable plain text for toolbar display; export uses the same title with the established safe-basename normalization.
- Missing or unusable H1 content falls back to `Untitled.md` for display and `untitled` for export basenames.

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
- The toolbar entry is labelled AI writing and remains visibly experimental because it depends on Chrome's evolving Prompt API.
- The ready dialog offers Improve writing, Structure notes, and Summarize. The application selects the action outside JSON-encoded untrusted Markdown data; document instructions cannot change it.
- Capability guidance is state-based: a missing/incompatible API requires a supported Chrome desktop runtime, while a present API reporting unavailable identifies the local model as unavailable on that device.

### AI session isolation

- Maintain a reusable warm base session containing only static cleanup instructions.
- Never put document content into the reusable base session.
- Clone the base session for each cleanup operation.
- Destroy the task clone afterward.
- This avoids cross-document conversational context contamination while reducing repeated cold setup.

### AI streaming and application

- The Chrome provider may use `promptStreaming()` internally for compatibility, but it collects the stream into one validated final result.
- React receives no partial model output. While generation runs, the review shows a static accessible status; the complete suggestion appears only after successful completion.
- Applying a completed suggestion must use the existing document update/autosave path.
- Cancel must leave the original Markdown unchanged.

### Background AI operations

- Initial capability checks, enablement consent, model download, and session preparation remain visible modal operations. Only document generation runs in the background.
- Selecting Improve writing, Structure notes, or Summarize captures the action and exact source, starts one cancellable operation, closes the modal, and returns control to the editor.
- AI operation state is a discriminated state model. The toolbar exposes compact idle, working, ready, outdated, and controlled-error states without animation or fabricated progress.
- Complete and failed operations use an application-local polite notification. Notifications request no browser permission, persist nothing, and never contain document-derived text.
- Dismissing a notification does not discard its review. Completed output remains reachable from the AI toolbar until it is applied or explicitly cancelled.
- Editing never aborts an active generation. It irreversibly marks the captured result outdated; even restoring identical source does not make that result applicable again.
- Background source snapshots, suggestions, operation identities, abort controllers, and notification state are memory-only and are intentionally lost on refresh.
- Closing, escaping, or clicking outside the working-status dialog continues generation. Only the explicit Cancel AI action aborts it.
- This background workflow completes the planned feature scope for the current release, subject to manual Chrome acceptance.

### Mermaid preview

- Mermaid fences render only in preview and never alter the CodeMirror source.
- Mermaid is a pinned local dependency and is dynamically imported only when a preview contains a Mermaid fence.
- Rendering uses Mermaid strict security mode with HTML labels disabled. Generated SVG crosses a second application-owned sanitization boundary before insertion.
- Diagram operations carry a render identity so stale asynchronous output cannot replace a newer preview or theme render.
- Mermaid validates syntax with suppressed parser errors before rendering. Every render uses a per-block owned temporary host and explicitly removes it on success, failure, staleness, and unmount.
- Invalid diagrams show one controlled error inside their preview block. Mermaid's built-in error SVG, parser text, and temporary render nodes must never be attached outside that block.

### AI setup behavior

- Distinguish unsupported from present-but-stalled setup.
- Model setup has a 40-second inactivity watchdog; advancing download progress resets it.
- Display a setup percentage only when it comes from a genuine browser `downloadprogress` event. Preparation without measurable progress is indeterminate, and time-based or fabricated setup percentages are prohibited.
- Repeated or decreasing browser progress does not advance the UI or reset the setup watchdog. Once genuine download progress reaches completion, session creation is described as finalizing rather than manufacturing a completion value.
- Retry starts fresh setup state rather than relying on a stale aborted setup.
- Do not use a fake inference percentage.
- Do not apply a short timeout to legitimate inference simply because generation is slow.

### AI enablement preference

- Successful explicit AI enablement is remembered under the versioned local preference key `markdown-toolkit:ai-enabled:v1` with the value `true`.
- Only enablement consent is persisted. Providers, model sessions, availability results, setup state, documents, prompts, suggestions, errors, and metrics are never stored in this preference.
- Runtime capability always overrides remembered enablement. Unsupported, unavailable, or unknown runtime states never become ready based on the saved preference.
- Page load never checks capability, creates a session, or initiates a model download. Opening AI writing is the explicit interaction that starts capability detection and, when enablement is remembered, the normal visible preparation flow.
- Preference storage failures are non-disruptive. A successful runtime session remains usable even when its preference cannot be saved.

### AI dialog presentation

- The ready chooser is intentionally minimal: its visible content is the AI writing heading and the three writing actions. Longer action explanations live in accessible titles rather than persistent body copy.
- Close is the sole dismissal control for the ready chooser and completed/outdated reviews. Closing a completed review preserves it for later access from the toolbar.
- Redundant Cancel actions are omitted when Close has the same behavior. Cancel AI remains in the working dialog because it explicitly aborts background generation, unlike Close or Continue in background.
- The POC metrics panel and its React presentation state are not part of the production UI. Do not replace them with hidden DOM, console logging, telemetry, or persistence.

### AI hardening boundaries

- AI UI state uses an explicit discriminated state model. Session readiness is represented by the state rather than coordinated through an independent readiness flag.
- Every setup and generation operation has a unique identity. Late callbacks are ignored after cancellation, replacement, or unmount.
- Session recovery is visible. An expired session is cleared and reported; retry uses the normal cancellable setup flow and inactivity watchdog. Generation must not recreate a base session invisibly.
- The full cleanup prompt is submitted only after the provider's supported context-measurement API confirms it fits. Missing or failed measurement rejects the operation before prompting.
- Once a cleanup review becomes stale because the source changed, it never becomes valid automatically, even if the document later returns to byte-for-byte identical content. The user must regenerate or cancel.
- Provider and browser failures cross into React only as typed, content-free error categories. User-facing messages are controlled application copy; arbitrary browser error messages are never rendered or recorded in diagnostics.
- The production AI provider is owned by one React effect lifecycle. Development Strict Mode cleanup disposes that lifecycle's provider, and the following setup creates a fresh provider rather than reusing a disposed instance.
- Capability detection has a short watchdog independent of the model-setup watchdog. It never creates or downloads the model, ignores late availability results, and exposes a controlled retry state.

## Security / Privacy

- Markdown content stays local for V1.
- Sanitized preview/copy/download should use a consistent rendering/sanitization pipeline.
- Remote images embedded by the user may still cause the browser to make requests to their remote URLs; this is documented rather than hidden.
- AI POC must not send Markdown to hosted inference services.
- Cloudflare Web Analytics is deployment-managed and must not be manually embedded in application code. No custom interaction tracking, persistent analytics identifiers, document text, filenames, AI prompts, AI results, or editor keystrokes are intentionally sent as analytics data.
- Privacy language must acknowledge real network boundaries: remote images may contact their hosts, external links leave the application, Cloudflare measures traffic/performance, and Chrome may manage local-AI model resources.

## SEO / Discovery

- The production identity uses the title `Markdown Toolkit — Private Markdown Editor`, the approved capability-accurate description, and one canonical root URL at `https://markdown-toolkit.pages.dev/`.
- Open Graph and Twitter metadata use one local 1200×630 PNG generated deterministically from approved local branding. Social sharing must not depend on remote fonts, artwork, screenshots, or runtime image services.
- Structured data is limited to a factual `SoftwareApplication` description of released capabilities. Do not add ratings, reviews, download counts, unsupported platforms, or marketing claims without verifiable product data.
- The sitemap contains only the canonical root because Markdown Toolkit has no other crawlable routes. Do not invent route URLs for client-side dialog or editor states.
- Cloudflare Web Analytics remains deployment-managed and must not be embedded in repository metadata or application code.
- GitHub About description, website, and topics are applied manually after acceptance rather than mutated as part of application implementation.

## Repository Presentation

- The README presents the released product accurately and links to the live application before development details.
- The approved local social preview is reused as the repository's deterministic product image until an accepted editor screenshot is available.
- Browser and Chrome built-in AI limitations are stated explicitly; optional AI is never presented as a requirement for the editor.
- Public issue forms warn against sharing private Markdown. Security vulnerabilities are directed to GitHub Security Advisories rather than public issues.
- Roadmap entries describe accepted deferred work and evidence-led product growth, not release promises or invented timelines.

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

Update this file when a durable decision changes. Do not use it as a temporary task log; temporary/current status belongs in `PROJECT-STATE.md`.
