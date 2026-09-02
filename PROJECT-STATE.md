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

### Current issue

Ghost text is rendered using CodeMirror `Decoration.widget` / `WidgetType`.

- Chrome: acceptable / close to normal baseline
- Firefox: ghost text is on the correct editor line but appears slightly vertically misaligned
- A `Decoration.line + ::after` experiment made both Chrome and Firefox worse and was reverted
- Do not reintroduce that approach without a new design review

Current investigation is focused on CodeMirror empty-line/widget behavior, including `cm-widgetBuffer`, the trailing empty-line `<br>`, widget placement/`side`, and line-box geometry.

Firefox remains a manual verification target because the connected browser-debugging tooling could not provide trustworthy Firefox geometry.

## Local AI POC

Experimental local AI cleanup is implemented using Chrome's built-in `LanguageModel` Prompt API.

Implemented:

- AI Clean Up action
- Local/on-device inference only
- No hosted AI API or API key
- Original vs Suggestion review flow
- Explicit Apply / Cancel
- `promptStreaming()`
- Reusable warm base session
- Fresh clone per cleanup to avoid cross-document context contamination
- Development-only metrics
- Setup/download progress handling
- 40-second setup inactivity watchdog
- Retry / Cancel for stalled setup
- No browser sniffing

Manual browser results:

- Chrome: working
- Firefox: Chrome `LanguageModel` API unavailable; normal editor remains usable
- Arc: API surface may be present, but local-model setup can stall; watchdog handles this as a controlled readiness failure

WebLLM and other cross-browser local-AI fallbacks are deferred.

## QA / Validation

Most recent reported validation before the current autocomplete investigation:

- 178 tests across 21 files passed
- Lint passed
- Build passed
- Format check passed
- `git diff --check` passed
- Existing Vite >500 kB JavaScript chunk warning remains

These numbers should be updated after the current local Codex work is completed and manually accepted.

## Current Task

Investigate and fix the remaining Firefox ghost-text baseline alignment issue without browser sniffing or arbitrary pixel offsets.

Preferred order:

1. Understand current CodeMirror widget/empty-line DOM and geometry
2. Prefer the smallest CodeMirror-native fix
3. Keep existing prediction logic unchanged
4. Use manual Firefox verification
5. Only consider a cursor-coordinate overlay if the WidgetType path cannot be made reliable

## Development Workflow

1. Plan/design the feature or fix first
2. For complex work, review the design twice before implementation
3. Give Codex the implementation prompt only after design is settled
4. Codex implements and runs automated validation
5. Manual testing is performed
6. Fix regressions if needed
7. Commit/push only after manual approval

Do not treat this file as complete historical documentation. Update it whenever an active feature changes state or a major milestone is accepted.
