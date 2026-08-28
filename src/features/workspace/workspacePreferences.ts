const SPLIT_STORAGE_KEY = 'markdown-toolkit:workspace-split'
const LINE_NUMBERS_STORAGE_KEY = 'markdown-toolkit:line-numbers'

export const DEFAULT_SPLIT_PERCENT = 50
export const MIN_SPLIT_PERCENT = 25
export const MAX_SPLIT_PERCENT = 75

export function clampSplit(value: number) {
	return Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, value))
}

export function readSplitPercent() {
	const storedValue = readLocalPreference(SPLIT_STORAGE_KEY)
	const splitPercent = Number.parseFloat(storedValue ?? '')
	return Number.isFinite(splitPercent) ? clampSplit(splitPercent) : DEFAULT_SPLIT_PERCENT
}

export function writeSplitPercent(splitPercent: number) {
	writeLocalPreference(SPLIT_STORAGE_KEY, String(clampSplit(splitPercent)))
}

export function readLineNumbers() {
	return readLocalPreference(LINE_NUMBERS_STORAGE_KEY) === 'true'
}

export function writeLineNumbers(showLineNumbers: boolean) {
	writeLocalPreference(LINE_NUMBERS_STORAGE_KEY, String(showLineNumbers))
}
import {
	readLocalPreference,
	writeLocalPreference,
} from '../../shared/preferences/localPreferences'
