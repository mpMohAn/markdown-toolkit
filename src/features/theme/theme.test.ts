import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPreferredTheme, persistTheme } from './theme'
import { useTheme } from './useTheme'

describe('theme preference', () => {
	const storage = new Map<string, string>()
	let systemIsDark = false

	beforeEach(() => {
		storage.clear()
		systemIsDark = false
		Object.defineProperty(window, 'localStorage', {
			configurable: true,
			value: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => storage.set(key, value),
			},
		})
		window.matchMedia = vi.fn((query: string) => ({
			matches: systemIsDark,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(() => false),
		}))
	})

	it('follows a light system theme on first visit', () => {
		expect(getPreferredTheme()).toBe('light')
	})

	it('follows a dark system theme on first visit', () => {
		systemIsDark = true
		expect(getPreferredTheme()).toBe('dark')
	})

	it('restores an explicitly persisted light choice after refresh', () => {
		systemIsDark = true
		const firstRender = renderHook(useTheme)
		act(() => firstRender.result.current.toggleTheme())
		expect(storage.get('markdown-toolkit:theme')).toBe('light')
		firstRender.unmount()

		const refreshedRender = renderHook(useTheme)
		expect(refreshedRender.result.current.theme).toBe('light')
	})

	it('restores an explicitly persisted dark choice after refresh', () => {
		const firstRender = renderHook(useTheme)
		act(() => firstRender.result.current.toggleTheme())
		expect(storage.get('markdown-toolkit:theme')).toBe('dark')
		firstRender.unmount()

		const refreshedRender = renderHook(useTheme)
		expect(refreshedRender.result.current.theme).toBe('dark')
	})

	it('always gives a saved user preference priority over the system preference', () => {
		persistTheme('dark')
		systemIsDark = false
		expect(getPreferredTheme()).toBe('dark')

		persistTheme('light')
		systemIsDark = true
		expect(getPreferredTheme()).toBe('light')
	})
})
