import { beforeEach, describe, expect, it } from 'vitest'
import {
	AI_ENABLED_PREFERENCE_KEY,
	clearAIEnabledPreference,
	readAIEnabledPreference,
	writeAIEnabledPreference,
} from './aiPreferences'

describe('AI enablement preference', () => {
	const storage = new Map<string, string>()

	beforeEach(() => {
		storage.clear()
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
				removeItem: (key: string) => storage.delete(key),
			},
		})
	})

	it('stores only the versioned boolean enablement value', () => {
		writeAIEnabledPreference()
		expect(storage).toEqual(new Map([[AI_ENABLED_PREFERENCE_KEY, 'true']]))
	})

	it('reads, clears, and safely handles storage failures', () => {
		expect(readAIEnabledPreference()).toBe(false)
		writeAIEnabledPreference()
		expect(readAIEnabledPreference()).toBe(true)
		clearAIEnabledPreference()
		expect(readAIEnabledPreference()).toBe(false)

		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: {
				getItem: () => {
					throw new DOMException('private storage detail', 'SecurityError')
				},
			},
		})
		expect(readAIEnabledPreference()).toBe(false)
	})
})
