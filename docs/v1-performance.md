# Markdown Toolkit V1 Performance

Measured on 2026-08-28 with Node/Vite production builds on the local development machine. Sizes below are Vite's emitted-file measurements.

## Baseline

| Asset      |       Raw |      Gzip |
| ---------- | --------: | --------: |
| JavaScript | 873.72 kB | 289.32 kB |
| CSS        |  15.04 kB |   3.39 kB |

- Build: 325 transformed modules; 421 ms reported by Vite and 4.93 s end-to-end including TypeScript.
- Warning: the single JavaScript chunk exceeds Vite's 500 kB warning threshold.
- Tests: 79 tests across 15 files, all passing.

Sourcemap inspection identified the main source contributors as React DOM (~533 KiB unminified source), CodeMirror view/state/language packages and Lezer parsers (~1.3 MiB combined), followed by the unified/remark/rehype Markdown and sanitization pipeline. CodeMirror's Markdown support also brings HTML/CSS/JavaScript language support for mixed-language editing. The npm tree is deduplicated; no unused direct production dependency or duplicate renderer was found.

## Changes

- Deferred expensive preview rendering so urgent editor updates are committed first. There is no fixed debounce: the preview catches up as soon as React can process deferred work.
- Memoized the editor and preview pane boundaries so divider movement does not rerender either pane or reconfigure CodeMirror.
- Memoized the formatting toolbar so document edits do not rerender controls whose inputs did not change.
- Memoized word/character statistics by document content so theme changes, persistence status updates, and other shell renders do not rescan a large document.
- Added regression coverage that line-number reconfiguration retains the same CodeMirror instance and that continuous edits still coalesce into one 750 ms autosave.
- Kept the existing Markdown renderer and sanitizer shared by preview/copy/download. Core editor and renderer packages remain eagerly loaded because both are required for first use. Splitting the large chunk would move bytes between files without reducing initial JavaScript, so no cosmetic manual chunks were added.

The test-only large fixture contains about 22,000 words across headings, prose, nested lists, tables, task lists, links, code blocks, quotes, and repeated content. On this machine, rendering it through the production Markdown pipeline took approximately 0.5 s in the focused Vitest run. That measurement justified scheduling preview work behind editor input without introducing a timer.

## Manual large-document procedure

Use `createLargeMarkdownFixture()` from `src/test/fixtures/largeMarkdown.ts` in a local test or console harness; the fixture is under `src/test` and is not imported by production code.

1. Start a production preview, load the generated document, and refresh to exercise persisted-document hydration.
2. Record initial load and long-task activity in browser developer tools.
3. Paste the entire fixture. Type continuously near the top and bottom, including while autosave changes from Unsaved to Saving to Saved.
4. Confirm editor input and selection remain responsive while the preview catches up without stale final output.
5. Drag the divider continuously, then resize it with arrow keys. Confirm the preview is not reparsed merely because the split changes.
6. Toggle light/dark theme and line numbers. Confirm the theme does not reparse Markdown and the same editor instance, content, selection, history, and focus remain intact.
7. Exercise Copy/Download after editing and verify their existing exact-source and sanitized-HTML behavior.

## Final result and remaining risks

| Asset      | Baseline raw / gzip |   Final raw / gzip |           Change |
| ---------- | ------------------: | -----------------: | ---------------: |
| JavaScript |  873.72 / 289.32 kB | 873.81 / 289.35 kB | +0.09 / +0.03 kB |
| CSS        |     15.04 / 3.39 kB |    15.04 / 3.39 kB |             none |

The final build still transforms 325 modules and reports the same >500 kB warning. It took 451 ms in Vite and 4.52 s end-to-end. The negligible JavaScript increase comes from responsiveness scheduling and memo boundaries; this milestone improves update work rather than claiming a cosmetic bundle reduction.

The main remaining risk is unavoidable main-thread work: Markdown parsing/sanitization and CodeMirror are required at first paint, and a single preview parse of a very large document is synchronous. React deferral protects urgent updates and coalesces intermediate preview renders, but truly extreme documents can still produce a visible preview lag. Moving parsing to a worker would add cross-thread protocol and sanitizer/output complexity and was intentionally left outside this low-risk milestone.
