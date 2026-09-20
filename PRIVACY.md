# Markdown Toolkit Privacy

Last updated: 2026-09-20

## Documents

Markdown Toolkit stores the active Markdown document locally in the browser using IndexedDB. This supports document recovery and autosave. Markdown Toolkit does not provide an application server for storing documents.

Copy Markdown, Copy HTML, Download Markdown, and Download HTML operate locally in the browser. Downloaded HTML is produced from the same sanitized preview pipeline.

## Chrome built-in AI

AI writing is optional and is available only when a compatible Chrome runtime exposes its built-in AI capability. After the user explicitly starts an AI action, Markdown is processed by Chrome's local AI runtime.

Markdown Toolkit does not store source Markdown, AI prompts, or generated suggestions as analytics data. The only separately persisted AI setting is the local AI-enabled preference. Browser-managed AI components may perform their own model setup or download according to Chrome's implementation.

## Cloudflare Web Analytics

Cloudflare Web Analytics is used for basic traffic and performance measurement. Markdown Toolkit does not intentionally send document text, filenames, AI prompts, AI results, or editor keystrokes as analytics data. No custom feature-click analytics or persistent application analytics identifiers are implemented.

Cloudflare may process network and request information as described in its [Web Analytics documentation](https://developers.cloudflare.com/web-analytics/) and applicable privacy materials. The application does not manually embed a Cloudflare analytics script; analytics activation is managed through the deployment platform.

## External content and links

Remote images referenced by Markdown may contact their external host when rendered or when exported content is opened. Opening repository, sponsor, issue, document, or other external links leaves Markdown Toolkit and follows the destination site's privacy practices.

## Contact and reports

Questions or privacy concerns may be reported through [GitHub issues](https://github.com/mpMohAn/markdown-toolkit/issues/new).
