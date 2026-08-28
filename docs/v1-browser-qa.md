# Markdown Toolkit V1 Desktop Browser QA

Primary target: current desktop Chrome, Safari, and Firefox. Run this checklist in a normal window and, where practical, once with storage or clipboard permission restricted. Use [`fixtures/v1-markdown-qa.md`](fixtures/v1-markdown-qa.md) for rendering checks and the large fixture described in [`v1-performance.md`](v1-performance.md) for a large paste.

## Coverage status

### Automated

- IndexedDB schema creation, create/read/update/delete, missing records, malformed records, first-load document creation, and debounced persistence.
- `localStorage` preference parsing, clamping, blocked-storage handling, theme restoration, and line-number restoration.
- Clipboard success, rejected writes, unavailable Clipboard API, exact Markdown, and sanitized HTML.
- Blob artifact MIME type/content, safe filenames, temporary download anchor cleanup, and delayed object-URL revocation.
- Pointer resizing limits, pointer capture release on `pointerup` and `pointercancel`, double-click reset, and keyboard resize.
- CodeMirror command shortcuts, dropdown arrows/Home/End/Escape, focus return, and accessibility attributes.

These tests run in jsdom/fake-indexeddb. They protect application decisions but do not prove browser integration behavior.

### Standards/support review

The application uses APIs available in the current target browsers: IndexedDB, Web Storage, Clipboard `writeText` in secure contexts, Blob/object URLs, download anchors, `matchMedia`, Pointer Events/capture, and CodeMirror's supported DOM APIs. CSS uses Grid/Flexbox with `min-width: 0`, `focus-visible`, forced-colors, `overflow-wrap`, `overflow: clip`, OKLCH, and vendor-specific scrollbar rules as progressive styling. Unsupported scrollbar declarations are ignored without affecting scrolling. Desktop sizing uses `100vh`; no mobile viewport claim is made.

No browser sniffing or compatibility shim is used. Real browser verification remains required for permission UI, downloads, native `<details>/<summary>` interaction, IndexedDB policies, font rendering, focus/selection, and pointer capture.

## Browser matrix

Run every row in current desktop Chrome, Safari, and Firefox and record version/result.

| Area                | Chrome | Safari | Firefox |
| ------------------- | ------ | ------ | ------- |
| App/editor/preview  | ☐      | ☐      | ☐       |
| Toolbar/keyboard    | ☐      | ☐      | ☐       |
| Resize/persistence  | ☐      | ☐      | ☐       |
| Clipboard/download  | ☐      | ☐      | ☐       |
| Accessibility/focus | ☐      | ☐      | ☐       |

## Checklist per browser

### App and persistence

- Load with no console errors. With no saved theme, confirm the system theme is used; save the opposite theme and confirm refresh restores it.
- Edit, wait for Saved, refresh, and confirm content restores. Repeat with line numbers and a non-default split.
- Confirm first-load creation works. If storage is denied, confirm a visible failure state rather than a crash.

### Editor and preview

- Type, select, undo/redo, paste the large fixture, and edit near its top and bottom.
- Exercise Cmd shortcuts on macOS and Ctrl shortcuts elsewhere: B, I, K, Shift+7, and Shift+8. Confirm unrelated key combinations retain browser behavior.
- Toggle line numbers without losing content, selection, focus, or history.
- Check GFM headings, lists/tasks, tables, quotes, links, images, and code. Confirm wide tables/code and long strings scroll or wrap locally without page overflow.

### Toolbar and accessibility

- Use every control by mouse and Tab. Confirm visible focus and logical order.
- Open Heading, Copy, and Download with Enter/Space. Navigate with arrows, Home/End, and close with Escape; confirm focus returns to the trigger and opening one menu closes the others.
- Toggle theme and line numbers from the keyboard, then return to the editor without a trap.

### Workspace

- Drag the divider continuously, release outside/near the pane edge, and interrupt a drag where possible. Confirm resizing stops cleanly.
- Resize with arrows, double-click reset, refresh, and confirm the saved split.
- Narrow the window enough to reach the existing stacked layout; confirm it remains usable without evaluating mobile polish.

### Clipboard and downloads

- Copy Markdown and compare exact whitespace/syntax. Copy HTML and confirm it contains rendered sanitized document HTML only.
- Deny/block clipboard permission and confirm “Copy failed”, never a false success.
- Download `.md` and `.html`; confirm filenames, UTF-8/Unicode, exact Markdown, standalone sanitized HTML, and no app UI/scripts.
- Pay special attention in Safari and Firefox to whether both small and large downloads start reliably after the object URL cleanup delay.

## Browser-specific attention

- Safari: clipboard permission/secure-context behavior, IndexedDB after refresh/private browsing, Blob downloads, pointer capture interruption, `<details>/<summary>` keyboard behavior, CodeMirror selection/focus, and grid overflow.
- Firefox: download/object-URL lifecycle, native summary focus, thin scrollbar styling, CodeMirror selection/focus, and pointer cancellation.
- Chrome: clipboard permission transitions, download policy prompts, IndexedDB refresh hydration, and console warnings.

## Current execution note

Automated validation was run during this milestone. A controllable desktop browser was not available in the implementation environment, so Chrome, Safari, and Firefox rows above are intentionally not marked as executed.
