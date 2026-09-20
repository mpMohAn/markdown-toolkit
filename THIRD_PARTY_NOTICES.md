# Third-Party Notices

## Google Material Symbols

The individually bundled SVG files in `src/assets/icons/material/` are selected from Google Material Symbols.

- Source: https://github.com/google/material-design-icons
- Copyright: Google LLC and the Material Design Authors
- License: Apache License 2.0
- License text: https://github.com/google/material-design-icons/blob/master/LICENSE

Included icons:

- `arrow_drop_down`
- `auto_awesome`
- `checklist`
- `code`
- `code_blocks`
- `content_copy`
- `dark_mode`
- `download`
- `format_align_left`
- `format_bold`
- `format_italic`
- `format_list_bulleted`
- `format_list_numbered`
- `format_paragraph`
- `format_quote`
- `format_strikethrough`
- `image`
- `info`
- `light_mode`
- `link`
- `tag`

Only icons visible in the Markdown Toolkit toolbar are included. The application uses the SVGs as local CSS masks so they inherit the current text colour. No icon font, CDN, or external runtime asset is loaded.

## Mermaid

Markdown Toolkit bundles Mermaid `12.0.0` as a pinned npm dependency and loads it only for preview documents containing Mermaid fences.

- Source: https://github.com/mermaid-js/mermaid
- Copyright: Mermaid contributors
- License: MIT
- License text: https://github.com/mermaid-js/mermaid/blob/develop/LICENSE
