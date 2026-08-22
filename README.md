# Markdown Toolkit

A local-first Markdown workspace for developers. The first milestone establishes the React/TypeScript foundation, design tokens, responsive application shell, theming, accessibility primitives, and test tooling.

## Commands

- `npm run dev` — start the local development server
- `npm run build` — type-check and produce a production build
- `npm run lint` — run static linting
- `npm run format:check` — verify formatting
- `npm run format` — apply formatting
- `npm test` — run the test suite once

## Architecture

`src/app` contains application composition. Feature folders own vertical slices of functionality. `src/shared` contains only cross-feature UI and styling foundations. Domain logic should remain framework-independent where practical; upcoming document state, rendering, and persistence modules will not depend on React.

V1 exposes a single document. A later persistence repository will be designed for multiple documents without prematurely adding document-management UI.
