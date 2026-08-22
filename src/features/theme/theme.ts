export const themes = ['light', 'dark'] as const

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
