# Markdown Toolkit

A compact, local-first Markdown editor with a live sanitized preview. Markdown Toolkit runs in the browser and keeps document storage on the device.

## Features

- Markdown editor powered by CodeMirror
- Live sanitized GitHub Flavored Markdown preview
- Browser-only, local-first persistence with autosave
- Compact formatting toolbar and keyboard shortcuts
- Resizable editor and preview panes
- Light and dark themes
- Optional editor line numbers
- Copy exact Markdown or sanitized HTML
- Download Markdown or a standalone HTML document

## Privacy

Document content stays in browser storage. Markdown Toolkit requires no account and does not use a backend for document storage.

Remote images referenced by a Markdown document may still cause the browser to make network requests to those image hosts when the preview is rendered.

## Development

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

Available validation commands:

```sh
npm run build
npm test
npm run lint
npm run format:check
```

## Tech stack

- React
- TypeScript
- Vite
- CodeMirror
- remark/rehype ecosystem
- IndexedDB
