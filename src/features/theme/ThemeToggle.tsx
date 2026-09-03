import { MaterialIcon } from '../../shared/components/MaterialIcon'
import type { Theme } from './theme'

interface ThemeToggleProps {
	theme: Theme
	onToggle: () => void
}

export function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
	const isDark = theme === 'dark'

	return (
		<button
			className="theme-toggle"
			type="button"
			aria-pressed={isDark}
			aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
			title={`Switch to ${isDark ? 'light' : 'dark'} theme`}
			onClick={onToggle}
		>
			<MaterialIcon name={isDark ? 'lightMode' : 'darkMode'} />
		</button>
	)
}
