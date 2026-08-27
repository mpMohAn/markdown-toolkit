import { useState } from 'react'
import { getSystemTheme, type Theme } from './theme'

interface ThemeController {
	theme: Theme
	toggleTheme: () => void
}

export function useTheme(): ThemeController {
	const [theme, setTheme] = useState<Theme>(getSystemTheme)

	return {
		theme,
		toggleTheme: () =>
			setTheme((currentTheme) => (currentTheme === 'light' ? 'dark' : 'light')),
	}
}
