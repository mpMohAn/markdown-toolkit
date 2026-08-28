import {
	readLocalPreference,
	writeLocalPreference,
} from '../../shared/preferences/localPreferences'

export const themes = ['light', 'dark'] as const

const THEME_STORAGE_KEY = 'markdown-toolkit:theme'

export type Theme = (typeof themes)[number]

export function getSystemTheme(): Theme {
	if (typeof window === 'undefined') {
		return 'light'
	}

	if (typeof window.matchMedia !== 'function') {
		return 'light'
	}

	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getPreferredTheme(): Theme {
	const storedTheme = readLocalPreference(THEME_STORAGE_KEY)
	return isTheme(storedTheme) ? storedTheme : getSystemTheme()
}

export function persistTheme(theme: Theme) {
	writeLocalPreference(THEME_STORAGE_KEY, theme)
}

export function applyTheme(theme: Theme) {
	if (typeof document !== 'undefined') {
		document.documentElement.dataset.theme = theme
	}
}

function isTheme(value: string | null): value is Theme {
	return themes.some((theme) => theme === value)
}
