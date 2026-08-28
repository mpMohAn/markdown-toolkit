export function readLocalPreference(key: string) {
	if (typeof window === 'undefined') return null

	try {
		return window.localStorage.getItem(key)
	} catch {
		return null
	}
}

export function writeLocalPreference(key: string, value: string) {
	try {
		window.localStorage.setItem(key, value)
	} catch {
		// Preferences remain usable for the session when local storage is blocked.
	}
}
