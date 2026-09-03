/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tokensCss = readFileSync(`${process.cwd()}/src/shared/styles/tokens.css`, 'utf8')
const editorSource = readFileSync(`${process.cwd()}/src/features/editor/MarkdownEditor.tsx`, 'utf8')

describe('CodeMirror heading colour tokens', () => {
	it.each([
		['light', getThemeBlock(':root')],
		['dark', getThemeBlock("[data-theme='dark']")],
	] as const)('keeps the shared %s heading token at AA contrast', (_theme, block) => {
		const background = parseOklch(readToken(block, '--color-surface'))
		const heading = readToken(block, '--color-editor-heading')

		expect(contrastRatio(parseOklch(heading), background)).toBeGreaterThanOrEqual(4.5)
		expect(block).not.toMatch(/--color-editor-heading-[1-6]/)
	})

	it('maps H1 through H6 to the one shared editor heading token', () => {
		for (let level = 1; level <= 6; level += 1) {
			expect(editorSource).toContain(`tags.heading${level}`)
		}
		expect(editorSource.match(/var\(--color-editor-heading\)/g)).toHaveLength(1)
		expect(editorSource).not.toMatch(/color-editor-heading-[1-6]/)
	})
})

function getThemeBlock(selector: string) {
	const start = tokensCss.indexOf(`${selector} {`)
	const end = tokensCss.indexOf('\n}', start)
	if (start === -1 || end === -1) throw new Error(`Missing token block: ${selector}`)
	return tokensCss.slice(start, end)
}

function readToken(block: string, name: string) {
	const match = new RegExp(`${name}:\\s*([^;]+);`).exec(block)
	if (!match) throw new Error(`Missing token: ${name}`)
	return match[1].trim()
}

function parseOklch(value: string) {
	const match = /^oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)$/.exec(value)
	if (!match) throw new Error(`Unsupported colour: ${value}`)
	return { lightness: Number(match[1]) / 100, chroma: Number(match[2]), hue: Number(match[3]) }
}

function contrastRatio(first: Oklch, second: Oklch) {
	const firstLuminance = relativeLuminance(first)
	const secondLuminance = relativeLuminance(second)
	return (
		(Math.max(firstLuminance, secondLuminance) + 0.05) /
		(Math.min(firstLuminance, secondLuminance) + 0.05)
	)
}

interface Oklch {
	lightness: number
	chroma: number
	hue: number
}

function relativeLuminance({ lightness, chroma, hue }: Oklch) {
	const radians = (hue * Math.PI) / 180
	const a = chroma * Math.cos(radians)
	const b = chroma * Math.sin(radians)
	const l = Math.pow(lightness + 0.3963377774 * a + 0.2158037573 * b, 3)
	const m = Math.pow(lightness - 0.1055613458 * a - 0.0638541728 * b, 3)
	const s = Math.pow(lightness - 0.0894841775 * a - 1.291485548 * b, 3)
	const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)
	const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)
	const blue = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
	return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function clamp(value: number) {
	return Math.min(1, Math.max(0, value))
}
