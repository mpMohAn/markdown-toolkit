import { type KeyboardEvent, type ReactNode, type RefObject, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

interface AccessibleDialogProps {
	title: string
	onClose: () => void
	restoreFocusRef: RefObject<HTMLElement | null>
	children: ReactNode
	className?: string
}

export function AccessibleDialog({
	title,
	onClose,
	restoreFocusRef,
	children,
	className = '',
}: AccessibleDialogProps) {
	const titleId = useId()
	const dialogRef = useRef<HTMLElement>(null)
	const closeButtonRef = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		const trigger = restoreFocusRef.current
		const background = trigger?.closest<HTMLElement>('.app-shell') ?? null
		const wasInert = background ? background.inert || background.hasAttribute('inert') : false
		if (background) {
			background.inert = true
			background.setAttribute('inert', '')
		}
		closeButtonRef.current?.focus()

		const handleKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key !== 'Escape') return
			event.preventDefault()
			onClose()
		}
		const containFocus = (event: FocusEvent) => {
			if (!dialogRef.current?.contains(event.target as Node)) closeButtonRef.current?.focus()
		}
		document.addEventListener('keydown', handleKeyDown)
		document.addEventListener('focusin', containFocus)

		return () => {
			document.removeEventListener('keydown', handleKeyDown)
			document.removeEventListener('focusin', containFocus)
			if (background) {
				background.inert = wasInert
				if (wasInert) background.setAttribute('inert', '')
				else background.removeAttribute('inert')
			}
			if (trigger?.isConnected) trigger.focus()
		}
	}, [onClose, restoreFocusRef])

	const trapTab = (event: KeyboardEvent<HTMLElement>) => {
		if (event.key !== 'Tab') return
		const focusable = getFocusableElements(event.currentTarget)
		if (focusable.length === 0) {
			event.preventDefault()
			return
		}
		const first = focusable[0]
		const last = focusable[focusable.length - 1]
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault()
			last.focus()
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault()
			first.focus()
		}
	}

	return createPortal(
		<div
			className="app-dialog-backdrop"
			onMouseDown={(event) => {
				if (event.target === event.currentTarget) onClose()
			}}
		>
			<section
				ref={dialogRef}
				className={`app-dialog${className ? ` ${className}` : ''}`}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				onKeyDown={trapTab}
			>
				<header className="app-dialog-header">
					<h2 id={titleId}>{title}</h2>
					<button
						type="button"
						ref={closeButtonRef}
						onClick={onClose}
						aria-label={`Close ${title}`}
					>
						×
					</button>
				</header>
				<div className="app-dialog-body">{children}</div>
			</section>
		</div>,
		document.body,
	)
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(
		container.querySelectorAll<HTMLElement>(
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	).filter((element) => !element.hidden)
}
