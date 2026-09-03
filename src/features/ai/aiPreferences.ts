import {
	readLocalPreference,
	writeLocalPreference,
} from '../../shared/preferences/localPreferences'

export const AI_ENABLED_PREFERENCE_KEY = 'markdown-toolkit:ai-enabled:v1'

export function readAIEnabledPreference(): boolean {
	return readLocalPreference(AI_ENABLED_PREFERENCE_KEY) === 'true'
}

export function writeAIEnabledPreference(): void {
	writeLocalPreference(AI_ENABLED_PREFERENCE_KEY, 'true')
}

export function clearAIEnabledPreference(): void {
	try {
		window.localStorage.removeItem(AI_ENABLED_PREFERENCE_KEY)
	} catch {
		// This does not affect Chrome-managed model data.
	}
}
