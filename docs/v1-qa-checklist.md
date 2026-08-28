# Markdown Toolkit V1 QA Checklist

Use [`fixtures/v1-markdown-qa.md`](fixtures/v1-markdown-qa.md) as the manual test document.

## Markdown rendering

- Confirm H1–H6, inline styles, code, quotes, lists, tasks, tables, images, rules, Unicode, and malformed Markdown render without breaking the layout.
- Confirm long URLs, unbroken strings, code lines, nested lists, and wide tables wrap or scroll locally without page-level overflow.
- Confirm empty and whitespace-only documents show quiet editor/preview empty states.

## Toolbar and keyboard

- Tab through controls in logical order; verify every control has a visible neutral focus indicator.
- Open Heading, Copy, and Download with Enter and Space; navigate menu items with Up/Down, Home, and End.
- Press Escape in each menu; verify it closes and focus returns to its trigger.
- Run formatting shortcuts, toggle theme/line numbers, then return to the editor without a keyboard trap.

## Security

- Paste script tags, event-handler attributes, iframes, objects, embeds, styles, `javascript:` links, and unsafe `data:` URLs.
- Confirm none execute or create unsafe preview links/embedded content.
- Confirm copied and downloaded HTML contain the same sanitized output as the preview and contain no scripts or event attributes.

## Copy, download, and persistence

- Confirm copied/downloaded Markdown exactly matches source, including whitespace and fences.
- Confirm HTML copy is a sanitized fragment and HTML download is a sanitized standalone document.
- Confirm safe H1-derived filenames and `untitled` fallbacks.
- Refresh after editing, resizing, changing theme, and toggling line numbers; confirm all appropriate state restores.

## Themes and resize

- Check readable text, links, code, quotes, tables, muted text, selections, and focus in light and dark themes.
- Drag the divider to both limits; test arrow resizing and double-click reset while focused.
- Check the stacked layout at the existing small-screen breakpoint.
