/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(`${process.cwd()}/src/shared/styles/index.css`, 'utf8')
const tokens = readFileSync(`${process.cwd()}/src/shared/styles/tokens.css`, 'utf8')
const editorSource = readFileSync(`${process.cwd()}/src/features/editor/MarkdownEditor.tsx`, 'utf8')

describe('workspace visual rules', () => {
	it('uses one semantic token for primary application seams', () => {
		expect(rule('.app-toolbar')).toContain(
			'border-bottom: var(--border-width) solid var(--color-workspace-border)',
		)
		expect(rule('.app-footer')).toContain(
			'border-top: var(--border-width) solid var(--color-workspace-border)',
		)
		expect(rule('.workspace-divider::after')).toContain(
			'background: var(--color-workspace-border)',
		)
		expect(tokens.match(/--color-workspace-border:/g)).toHaveLength(2)
		expect(tokens).toContain('--color-border: var(--color-workspace-border)')
	})

	it('keeps the desktop split seam under one border owner', () => {
		expect(rule('.editor-pane')).not.toMatch(/border-(?:left|right)/)
		expect(rule('.preview-pane')).not.toMatch(/border-(?:left|right)/)
		expect(rule('.workspace-divider::after')).toContain('width: var(--border-width)')
	})

	it('keeps editor surfaces and boundaries independent of editor focus', () => {
		expect(styles).not.toMatch(/(?:editor-pane|markdown-editor).*:focus-within/)
		expect(editorSource).not.toContain("'&.cm-focused':")
		expect(editorSource).toContain("backgroundColor: 'var(--color-editor-surface)'")
	})

	it('retains a focus-visible state for the keyboard splitter', () => {
		expect(styles).toContain('.workspace-divider:focus-visible::after')
		expect(
			rule('.workspace-divider:hover::after,\n.workspace-divider:focus-visible::after'),
		).toContain('background: var(--color-interaction-hover)')
	})
})

function rule(selector: string) {
	const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`).exec(styles)
	if (!match) throw new Error(`Missing CSS rule: ${selector}`)
	return match[1]
}
