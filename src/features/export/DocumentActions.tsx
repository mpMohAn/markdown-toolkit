import { useRef, useState } from 'react'
import { handleToolbarMenuKeyDown } from '../../shared/components/toolbarMenuKeyboard'
import { copyDocument, downloadDocument, type DocumentFormat } from './documentExport'

interface DocumentActionsProps {
	content: string
}

type OpenMenu = 'copy' | 'download' | null

export function DocumentActions({ content }: DocumentActionsProps) {
	const [copyStatus, setCopyStatus] = useState('')
	const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
	const copyTriggerRef = useRef<HTMLElement>(null)
	const downloadTriggerRef = useRef<HTMLElement>(null)

	const handleCopy = async (format: DocumentFormat) => {
		const copied = await copyDocument(content, format)
		setCopyStatus(
			copied ? `${format === 'markdown' ? 'Markdown' : 'HTML'} copied` : 'Copy failed',
		)
		setOpenMenu(null)
		copyTriggerRef.current?.focus()
	}

	const handleMenuToggle = (menu: Exclude<OpenMenu, null>, isOpen: boolean) => {
		setOpenMenu((currentMenu) => {
			if (isOpen) return menu
			return currentMenu === menu ? null : currentMenu
		})
	}

	return (
		<div className="document-actions" aria-label="Document actions">
			<details
				className="toolbar-menu"
				name="markdown-toolbar-menu"
				open={openMenu === 'copy'}
				onToggle={(event) => handleMenuToggle('copy', event.currentTarget.open)}
				onKeyDown={(event) =>
					handleToolbarMenuKeyDown({
						event,
						setOpen: (open) => setOpenMenu(open ? 'copy' : null),
						triggerRef: copyTriggerRef,
					})
				}
			>
				<summary
					ref={copyTriggerRef}
					className="toolbar-menu-trigger"
					role="button"
					aria-expanded={openMenu === 'copy'}
					aria-haspopup="menu"
				>
					Copy ▾
				</summary>
				<div className="toolbar-menu-popover" role="menu">
					<button
						type="button"
						role="menuitem"
						onClick={() => void handleCopy('markdown')}
					>
						Markdown
					</button>
					<button type="button" role="menuitem" onClick={() => void handleCopy('html')}>
						HTML
					</button>
				</div>
			</details>

			<details
				className="toolbar-menu"
				name="markdown-toolbar-menu"
				open={openMenu === 'download'}
				onToggle={(event) => handleMenuToggle('download', event.currentTarget.open)}
				onKeyDown={(event) =>
					handleToolbarMenuKeyDown({
						event,
						setOpen: (open) => setOpenMenu(open ? 'download' : null),
						triggerRef: downloadTriggerRef,
					})
				}
			>
				<summary
					ref={downloadTriggerRef}
					className="toolbar-menu-trigger"
					role="button"
					aria-expanded={openMenu === 'download'}
					aria-haspopup="menu"
				>
					Download ▾
				</summary>
				<div className="toolbar-menu-popover toolbar-menu-popover-right" role="menu">
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							downloadDocument(content, 'markdown')
							setOpenMenu(null)
							downloadTriggerRef.current?.focus()
						}}
					>
						Markdown (.md)
					</button>
					<button
						type="button"
						role="menuitem"
						onClick={() => {
							downloadDocument(content, 'html')
							setOpenMenu(null)
							downloadTriggerRef.current?.focus()
						}}
					>
						HTML (.html)
					</button>
				</div>
			</details>
			<span className="visually-hidden" role="status">
				{copyStatus}
			</span>
		</div>
	)
}
