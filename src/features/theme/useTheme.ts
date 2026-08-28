import { useEffect, useState } from 'react'
import { applyTheme, getPreferredTheme, persistTheme, type Theme } from './theme'

interface ThemeController {
	theme: Theme
	toggleTheme: () => void
}

export function useTheme(): ThemeController {
	const [theme, setTheme] = useState<Theme>(getPreferredTheme)

	useEffect(() => applyTheme(theme), [theme])

	return {
		theme,
		toggleTheme: () =>
			setTheme((currentTheme) => {
				const nextTheme = currentTheme === 'light' ? 'dark' : 'light'
				persistTheme(nextTheme)
				applyTheme(nextTheme)
				return nextTheme
			}),
	}
}
