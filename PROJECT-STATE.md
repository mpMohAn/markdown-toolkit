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

Current hardening baseline:

- Branch: `main`
- AI POC commit: `e2d6b63 feat: add local AI cleanup POC`
- The AI POC is committed and pushed.
- Production-quality hardening is complete on `main` and is ready for its dedicated commit.

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

## Local AI Clean Up — hardening accepted

The experimental AI Clean Up POC was committed and pushed in `e2d6b63`. Its production hardening and Chrome manual acceptance are now complete on `main`.

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

Manual status:

- Chrome: functionally working
- Firefox: Chrome `LanguageModel` API unavailable; editor remains usable
- Arc: model setup can stall; watchdog provides a controlled readiness failure
- Feature status: Chrome manual acceptance passed, including genuine setup progress and dark-mode progress visibility

WebLLM and other cross-browser local-AI fallbacks remain deferred.

## Deferred Work

1. The Firefox autocomplete ghost baseline investigation is deferred and is outside the AI hardening scope.
2. WebLLM and other cross-browser local-AI fallbacks remain deferred.
3. The existing Vite >500 kB bundle warning remains accepted and unrelated.
4. Accepted future work, not implemented in the current hardening milestone: a compact branded application header, filename derivation from the first H1, H1–H6 editor syntax colours, and preview-only Mermaid support.

## QA / Validation

Latest validation after AI hardening:

- 23 test files
- 232 tests passed
- Lint passed
- Build passed
- Format check passed
- `git diff --check` passed
- Existing Vite >500 kB JavaScript chunk warning remains

Automated validation and manual Chrome acceptance both pass for the current feature scope.

## Current Task

Commit the accepted AI Clean Up hardening without including deferred autocomplete work or unrelated changes.

## Development Workflow

1. Plan/design the feature or fix first
2. For complex work, review the design twice before implementation
3. Give Codex the implementation prompt only after design is settled
4. Codex implements and runs automated validation
5. Manual testing is performed
6. Fix regressions if needed
7. Commit/push only after manual approval

Do not treat this file as complete historical documentation. Update it whenever an active feature changes state or a major milestone is accepted.
