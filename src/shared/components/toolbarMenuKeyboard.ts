import type { KeyboardEvent, RefObject } from 'react'

interface ToolbarMenuKeyboardOptions {
	event: KeyboardEvent<HTMLDetailsElement>
	setOpen: (open: boolean) => void
	triggerRef: RefObject<HTMLElement | null>
}

export function handleToolbarMenuKeyDown({
	event,
	setOpen,
	triggerRef,
}: ToolbarMenuKeyboardOptions) {
	const details = event.currentTarget
	const items = getEnabledMenuItems(details)
	const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement)

	if (event.key === 'Escape') {
		event.preventDefault()
		setOpen(false)
		triggerRef.current?.focus()
		return
	}

	if (
		event.target === triggerRef.current &&
		(event.key === 'ArrowDown' || event.key === 'ArrowUp')
	) {
		event.preventDefault()
		setOpen(true)
		queueMicrotask(() => {
			const nextItems = getEnabledMenuItems(details)
			const nextItem = event.key === 'ArrowDown' ? nextItems[0] : nextItems.at(-1)
			nextItem?.focus()
		})
		return
	}

	if (currentIndex === -1) return

	let nextIndex: number | null = null
	if (event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % items.length
	if (event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + items.length) % items.length
	if (event.key === 'Home') nextIndex = 0
	if (event.key === 'End') nextIndex = items.length - 1

	if (nextIndex !== null) {
		event.preventDefault()
		items[nextIndex]?.focus()
	}
}

function getEnabledMenuItems(details: HTMLDetailsElement) {
	return Array.from(
		details.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
	)
}
