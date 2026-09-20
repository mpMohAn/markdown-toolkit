# Markdown Toolkit — Project State

Last updated: 2026-09-20

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
- Compact branded application toolbar with three stable regions
- Independently window-centred document filename
- Right-side actions ordered as Copy, Download, AI writing, then Theme
- Shared accessible toolbar menus and individually bundled curated Material SVG files
- First-H1 document identity shared by toolbar display and safe export filenames
- One shared, accessible H1–H6 syntax colour in the CodeMirror editor
- Image Markdown formatting through the shared editor command layer
- One structural-border token with single ownership for header, footer, and split seams
- Stable editor surface and caret/active-line focus feedback without a pane focus border
- Independent editor and preview scrolling; synchronized scrolling was rejected and removed
- Deterministic, synchronous Format Markdown action with one-step undo
- Preview-only Mermaid fences, lazy-loaded from the pinned local dependency
- Copy Markdown / Copy HTML
- Download Markdown / Download standalone HTML
- Accessibility, security, and browser-compatibility hardening
- Release metadata, favicons, robots.txt
- Cloudflare Pages deployment
- Compact About menu with accessible About and Privacy dialogs
- Repository privacy documentation and capability-accurate privacy disclosures
- Production SEO, Open Graph, Twitter card, and factual SoftwareApplication metadata
- Local 1200×630 social preview image plus root-only sitemap discovery

## Repository / Working State

Current hardening baseline:

- Branch: `main`
- AI POC commit: `e2d6b63 feat: add local AI cleanup POC`
- The AI POC is committed and pushed.
- AI hardening commit: `565cea0 feat: harden local AI cleanup`
- Production-quality AI hardening and Chrome manual acceptance are complete.

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

### Ghost rendering

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

## Local AI writing — hardening retained

The experimental AI Clean Up POC was committed and pushed in `e2d6b63`. Its provider and lifecycle hardening remain in place, and the current release expands the review flow into three accepted AI writing actions.

Implemented behavior:

- Chrome `LanguageModel` capability detection only; no browser sniffing
- No hosted AI, API keys, application inference network calls, new AI SDKs, or new dependencies
- Explicit Enable AI action before local model creation/download
- One reusable warm base session containing static writing instructions only
- Fresh cloned session per writing action to avoid cross-document context contamination
- `promptStreaming()` collected inside the provider; React displays only the complete validated suggestion
- Original Markdown stays untouched until explicit Apply
- Cancel aborts setup or generation
- Apply uses the existing document update/autosave path
- 40-second inactivity watchdog for stalled model setup
- Advancing `downloadprogress` resets the watchdog
- Unsupported and stalled setup states remain distinct

Current hardening adds:

- A discriminated AI UI state model
- Operation identities, mounted checks, abort guards, and timer cleanup
- Typed provider errors with controlled user-facing messages
- Strict context measurement before any document prompt is submitted
- Explicit active-clone ownership and idempotent provider disposal
- Visible session-expiry recovery through the normal setup flow
- Irreversible stale-review state when the source document changes
- Modal focus containment, inert background content, Escape handling, and focus restoration
- Strict Mode-safe effect lifecycle ownership with a fresh provider per production lifecycle
- A separate four-second availability-check watchdog with controlled retry
- A versioned local AI enablement preference that stores only explicit user consent
- Capability checking and remembered session preparation begin only when the AI dialog opens
- Genuine Chrome `downloadprogress` reporting with indeterminate preparation and finalizing states; fabricated or time-driven setup percentages are prohibited
- Non-blocking document generation: choosing a writing action closes the modal while the captured source is processed in memory
- Compact toolbar states for working, ready, outdated, and controlled failure
- Application-local, non-persistent completion notifications with Review/Open and Dismiss actions
- Complete suggestions appear only in the later review dialog and still require explicit Apply
- Edits made during generation irreversibly mark that operation outdated without aborting it
- Working operations remain cancellable from the status dialog; ordinary dialog closure continues generation
- The ready chooser is intentionally limited to Improve writing, Structure notes, and Summarize, with details retained as accessible titles rather than persistent explanatory copy
- Completed and outdated reviews rely on the dialog Close control instead of a duplicate Cancel action; the distinct Cancel AI action remains available while generation is running
- The former POC metrics panel and its React-only diagnostic state have been removed

Mermaid failure containment:

- Mermaid source is validated with suppressed parser errors before rendering
- Each valid render uses a uniquely identified temporary host owned by its assigned preview block rather than `document.body`
- Owned temporary render nodes are removed after success, failure, stale output, and preview unmount
- Invalid syntax produces only the controlled inline `Unable to render Mermaid diagram.` message

Manual status:

- Chrome: functionally working
- Firefox: Chrome `LanguageModel` API unavailable; editor remains usable
- Arc: model setup can stall; watchdog provides a controlled readiness failure
- Previous cleanup flow: Chrome manual acceptance passed, including genuine setup progress and dark-mode progress visibility
- Current background Improve writing, Structure notes, and Summarize flow: manual Chrome acceptance passed
- Final minimal AI chooser, ready/outdated/error notifications, and POC metrics removal: manually accepted
- Mermaid valid/invalid rendering and contained failure behavior: manually accepted

WebLLM and other cross-browser local-AI fallbacks remain deferred.

## Deferred Work

1. The Firefox autocomplete ghost baseline investigation is deferred and is outside the AI hardening scope.
2. WebLLM and other cross-browser local-AI fallbacks remain deferred.
3. The existing Vite >500 kB bundle warning remains accepted and unrelated.
4. Mermaid `12.0.0` currently carries five high npm audit findings through `chevrotain@11.1.2` and `lodash-es@4.17.23`. The affected Lodash template/path functions are not imported by the runtime parser modules and were not found in the production output. npm offers no non-breaking Mermaid 12 patch; the suggested remediation is a major downgrade to Mermaid 11.17.2. This residual supply-chain risk is accepted for this release and should be revisited when a patched Mermaid 12 release is available.

## QA / Validation

Latest validation after adding SEO metadata, social sharing assets, structured data, and root-page search discovery:

- 32 test files
- 323 tests passed
- Lint passed
- Build passed
- Format check passed
- `git diff --check` passed
- Existing Vite >500 kB JavaScript chunk warning remains accepted

## Current Task

Manually verify the production metadata and social preview presentation. This step is implemented locally and remains uncommitted pending acceptance.

## About and Privacy

- One compact About control groups product information, privacy details, repository access, issue reporting, and optional GitHub Sponsors support without adding a permanent donation action.
- The About and Privacy dialogs trap focus, make the application background inert, close with Escape or backdrop activation, and restore focus to the About trigger.
- Cloudflare Web Analytics is enabled through the deployment platform. The application does not manually embed its beacon and implements no custom feature-click analytics.
- Document text, filenames, AI prompts, AI results, and editor keystrokes are outside the application's intended analytics scope.
- Remote Markdown images may contact their hosts, and external links follow destination-site privacy practices.

## SEO and Discovery

- The approved production title is `Markdown Toolkit — Private Markdown Editor`.
- The approved description is `Write, format, preview, and export Markdown privately in your browser, with Mermaid diagrams and optional Chrome built-in AI.`
- `https://markdown-toolkit.pages.dev/` is the sole canonical application URL and the only URL in the sitemap because the product has no additional crawlable routes.
- Open Graph and Twitter cards share a deterministic, locally generated 1200×630 PNG composed from the approved Markdown Toolkit logo and brand colours. It introduces no runtime image dependency.
- JSON-LD describes only released product capabilities and intentionally includes no ratings, reviews, download counts, unsupported platforms, or invented commercial claims.
- Cloudflare Web Analytics remains deployment-managed. No analytics script or custom tracking was added to repository source.
- After manual acceptance, GitHub About should use the approved production description, website URL, and focused Markdown/editor/privacy topics recorded in the implementation report.

## Development Workflow

1. Plan/design the feature or fix first
2. For complex work, review the design twice before implementation
3. Give Codex the implementation prompt only after design is settled
4. Codex implements and runs automated validation
5. Manual testing is performed
6. Fix regressions if needed
7. Commit/push only after manual approval

Do not treat this file as complete historical documentation. Update it whenever an active feature changes state or a major milestone is accepted.
