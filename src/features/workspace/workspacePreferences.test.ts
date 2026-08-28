import { beforeEach, describe, expect, it } from 'vitest'
import {
	readLineNumbers,
	readSplitPercent,
	writeLineNumbers,
	writeSplitPercent,
} from './workspacePreferences'

describe('workspace preferences', () => {
	const storage = new Map<string, string>()

	beforeEach(() => {
		storage.clear()
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
			},
		})
	})

	it('defaults line numbers to off and persists changes', () => {
		expect(readLineNumbers()).toBe(false)

		writeLineNumbers(true)
		expect(readLineNumbers()).toBe(true)

		writeLineNumbers(false)
		expect(readLineNumbers()).toBe(false)
	})

	it('continues to persist and clamp the existing split preference', () => {
		writeSplitPercent(90)
		expect(readSplitPercent()).toBe(75)
	})
})
