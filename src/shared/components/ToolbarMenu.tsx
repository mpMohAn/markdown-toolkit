import {
	createContext,
	type KeyboardEvent,
	type ReactNode,
	useContext,
	useEffect,
	useId,
	useRef,
	useState,
} from 'react'

interface ToolbarMenuContextValue {
	openMenuId: string | null
	setOpenMenuId: (menuId: string | null) => void
}

const ToolbarMenuContext = createContext<ToolbarMenuContextValue | null>(null)

export function ToolbarMenuProvider({ children }: { children: ReactNode }) {
	const [openMenuId, setOpenMenuId] = useState<string | null>(null)
	return (
		<ToolbarMenuContext.Provider value={{ openMenuId, setOpenMenuId }}>
			{children}
		</ToolbarMenuContext.Provider>
	)
}

export interface ToolbarMenuItem {
	id: string
	label: string
	disabled?: boolean
	content?: ReactNode
	onSelect: () => void | Promise<void>
}

interface ToolbarMenuProps {
	id: string
	label: string
	title?: string
	disabled?: boolean
	triggerContent: ReactNode
	items: ToolbarMenuItem[]
	className?: string
	menuClassName?: string
	restoreTriggerFocusOnSelect?: boolean
}

export function ToolbarMenu({
	id,
	label,
	title = label,
	disabled = false,
	triggerContent,
	items,
	className = '',
	menuClassName = '',
	restoreTriggerFocusOnSelect = true,
}: ToolbarMenuProps) {
	const context = useContext(ToolbarMenuContext)
	if (!context) throw new Error('ToolbarMenu must be rendered inside ToolbarMenuProvider')

	const { openMenuId, setOpenMenuId } = context
	const isOpen = openMenuId === id
	const reactId = useId()
	const menuId = `toolbar-menu-${reactId.replaceAll(':', '')}`
	const rootRef = useRef<HTMLDivElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		if (!isOpen) return
		const closeOnOutsidePointer = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpenMenuId(null)
		}
		document.addEventListener('pointerdown', closeOnOutsidePointer)
		return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
	}, [isOpen, setOpenMenuId])

	const openAndFocus = (edge: 'first' | 'last') => {
		if (disabled) return
		setOpenMenuId(id)
		queueMicrotask(() => {
			const enabledItems = getEnabledMenuItems(rootRef.current)
			;(edge === 'first' ? enabledItems[0] : enabledItems.at(-1))?.focus()
		})
	}

	const close = (restoreFocus: boolean) => {
		setOpenMenuId(null)
		if (restoreFocus) queueMicrotask(() => triggerRef.current?.focus())
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key === 'Escape' && isOpen) {
			event.preventDefault()
			close(true)
			return
		}
		if (event.target === triggerRef.current) {
			if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault()
				openAndFocus(event.key === 'ArrowDown' ? 'first' : 'last')
			}
			return
		}

		const enabledItems = getEnabledMenuItems(rootRef.current)
		const currentIndex = enabledItems.indexOf(document.activeElement as HTMLButtonElement)
		if (currentIndex === -1) return

		let nextIndex: number | null = null
		if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % enabledItems.length
		if (event.key === 'ArrowUp') {
			nextIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length
		}
		if (event.key === 'Home') nextIndex = 0
		if (event.key === 'End') nextIndex = enabledItems.length - 1
		if (event.key === 'Tab') {
			setOpenMenuId(null)
			return
		}
		if (nextIndex !== null) {
			event.preventDefault()
			enabledItems[nextIndex]?.focus()
		}
	}

	return (
		<div
			ref={rootRef}
			className={`toolbar-menu${className ? ` ${className}` : ''}`}
			onKeyDown={handleKeyDown}
		>
			<button
				ref={triggerRef}
				type="button"
				className="toolbar-menu-trigger"
				aria-label={label}
				title={title}
				aria-haspopup="menu"
				aria-expanded={isOpen}
				aria-controls={isOpen ? menuId : undefined}
				disabled={disabled}
				onClick={() => setOpenMenuId(isOpen ? null : id)}
			>
				{triggerContent}
			</button>
			{isOpen ? (
				<div
					id={menuId}
					className={`toolbar-menu-popover${menuClassName ? ` ${menuClassName}` : ''}`}
					role="menu"
				>
					{items.map((item) => (
						<button
							type="button"
							role="menuitem"
							aria-label={item.label}
							key={item.id}
							disabled={item.disabled}
							onClick={() => {
								if (item.disabled) return
								close(restoreTriggerFocusOnSelect)
								void item.onSelect()
							}}
						>
							{item.content ?? item.label}
						</button>
					))}
				</div>
			) : null}
		</div>
	)
}

function getEnabledMenuItems(root: HTMLDivElement | null) {
	return Array.from(
		root?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [],
	)
}
