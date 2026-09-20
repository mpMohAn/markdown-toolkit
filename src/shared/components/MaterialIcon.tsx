import type { CSSProperties } from 'react'
import arrowDropDown from '../../assets/icons/material/arrow_drop_down.svg'
import autoAwesome from '../../assets/icons/material/auto_awesome.svg'
import checklist from '../../assets/icons/material/checklist.svg'
import code from '../../assets/icons/material/code.svg'
import codeBlocks from '../../assets/icons/material/code_blocks.svg'
import contentCopy from '../../assets/icons/material/content_copy.svg'
import darkMode from '../../assets/icons/material/dark_mode.svg'
import download from '../../assets/icons/material/download.svg'
import formatAlignLeft from '../../assets/icons/material/format_align_left.svg'
import formatBold from '../../assets/icons/material/format_bold.svg'
import formatItalic from '../../assets/icons/material/format_italic.svg'
import formatListBulleted from '../../assets/icons/material/format_list_bulleted.svg'
import formatListNumbered from '../../assets/icons/material/format_list_numbered.svg'
import formatParagraph from '../../assets/icons/material/format_paragraph.svg'
import formatQuote from '../../assets/icons/material/format_quote.svg'
import formatStrikethrough from '../../assets/icons/material/format_strikethrough.svg'
import image from '../../assets/icons/material/image.svg'
import info from '../../assets/icons/material/info.svg'
import lightMode from '../../assets/icons/material/light_mode.svg'
import link from '../../assets/icons/material/link.svg'
import numbers from '../../assets/icons/material/tag.svg'

const icons = {
	arrowDropDown,
	autoAwesome,
	checklist,
	code,
	codeBlocks,
	contentCopy,
	darkMode,
	download,
	formatAlignLeft,
	formatBold,
	formatItalic,
	formatListBulleted,
	formatListNumbered,
	formatParagraph,
	formatQuote,
	formatStrikethrough,
	image,
	info,
	lightMode,
	link,
	numbers,
} as const

export type MaterialIconName = keyof typeof icons

interface MaterialIconStyle extends CSSProperties {
	'--material-icon-source': `url("${string}")`
}

export function MaterialIcon({
	name,
	className = '',
}: {
	name: MaterialIconName
	className?: string
}) {
	const style: MaterialIconStyle = {
		'--material-icon-source': `url("${icons[name]}")`,
	}

	return (
		<span
			className={`material-icon${className ? ` ${className}` : ''}`}
			style={style}
			aria-hidden="true"
		/>
	)
}
