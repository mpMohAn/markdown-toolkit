import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AIAvailability, AIProvider } from './AIProvider'
import { ChromeBuiltInAIProvider } from './chromeBuiltInAIProvider'
import {
	cleanupMarkdown,
	MARKDOWN_CLEANUP_SYSTEM_PROMPT,
	validateCleanupOutput,
} from './markdownCleanup'

type UIStatus = 'checking' | AIAvailability | 'preparing' | 'ready' | 'running' | 'error'

interface POCMetrics {
	availability?: AIAvailability
	sessionStatus?: 'not-ready' | 'ready' | 'generating' | 'error'
	setupDurationMs?: number
	generationDurationMs?: number
	inputCharacters?: number
	outputCharacters?: number
	contextUsage?: number
	contextWindow?: number
	result?: 'success' | 'failure' | 'cancelled'
}

interface AICleanupProps {
	content: string
	onApply: (content: string) => void
	provider?: AIProvider
	setupWatchdogMs?: number
}

const DEFAULT_SETUP_WATCHDOG_MS = 40_000

export function AICleanup({
	content,
	onApply,
	provider: providedProvider,
	setupWatchdogMs = DEFAULT_SETUP_WATCHDOG_MS,
}: AICleanupProps) {
	const [provider] = useState<AIProvider>(() => providedProvider ?? new ChromeBuiltInAIProvider())
	const [isOpen, setIsOpen] = useState(false)
	const [status, setStatus] = useState<UIStatus>('checking')
	const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
	const [original, setOriginal] = useState('')
	const [suggestion, setSuggestion] = useState('')
	const [errorMessage, setErrorMessage] = useState('')
	const [isSlow, setIsSlow] = useState(false)
	const [metrics, setMetrics] = useState<POCMetrics>({ sessionStatus: 'not-ready' })
	const availabilityRef = useRef<AIAvailability>('unsupported')
	const sessionReadyRef = useRef(false)
	const operationRef = useRef(0)
	const abortRef = useRef<AbortController | null>(null)
	const partialUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingPartialRef = useRef('')
	const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const setupWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const setupProgressRef = useRef<number | null>(null)
	const headingId = useId()
	const closeButtonRef = useRef<HTMLButtonElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)

	function clearTimers() {
		if (partialUpdateRef.current) clearTimeout(partialUpdateRef.current)
		if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
		if (setupWatchdogRef.current) clearTimeout(setupWatchdogRef.current)
		partialUpdateRef.current = null
		slowTimerRef.current = null
		setupWatchdogRef.current = null
	}

	useEffect(() => {
		let active = true
		void provider
			.getAvailability()
			.then((availability) => {
				if (!active) return
				availabilityRef.current = availability
				setStatus(availability)
				setMetrics((current) => ({ ...current, availability }))
			})
			.catch(() => {
				if (!active) return
				setStatus('error')
				setErrorMessage('Local AI availability could not be checked.')
				setMetrics((current) => ({ ...current, result: 'failure' }))
			})

		return () => {
			active = false
			abortRef.current?.abort()
			clearTimers()
			provider.dispose()
		}
	}, [provider])

	useEffect(() => {
		if (isOpen) closeButtonRef.current?.focus()
	}, [isOpen])

	const open = () => {
		setErrorMessage('')
		setIsOpen(true)
	}

	const cancel = () => {
		operationRef.current += 1
		abortRef.current?.abort()
		abortRef.current = null
		clearTimers()
		setIsSlow(false)
		setOriginal('')
		setSuggestion('')
		setErrorMessage('')
		setStatus(sessionReadyRef.current ? 'ready' : availabilityRef.current)
		setMetrics((current) => ({
			...current,
			sessionStatus: sessionReadyRef.current ? 'ready' : 'not-ready',
			result: 'cancelled',
		}))
		setIsOpen(false)
		triggerRef.current?.focus()
	}

	const enable = async () => {
		abortRef.current?.abort()
		clearTimers()
		const operation = ++operationRef.current
		const controller = new AbortController()
		abortRef.current = controller
		setErrorMessage('')
		setDownloadProgress(null)
		setupProgressRef.current = null
		setStatus('preparing')
		armSetupWatchdog(operation, controller)
		try {
			const setup = await provider.initialize(MARKDOWN_CLEANUP_SYSTEM_PROMPT, {
				signal: controller.signal,
				onDownloadProgress: (progress) => {
					if (operation !== operationRef.current) return
					setDownloadProgress(progress)
					if (setupProgressRef.current === null || progress > setupProgressRef.current) {
						setupProgressRef.current = progress
						armSetupWatchdog(operation, controller)
					}
				},
			})
			if (operation !== operationRef.current) return
			clearTimers()
			sessionReadyRef.current = true
			setMetrics((current) => ({
				...current,
				sessionStatus: 'ready',
				setupDurationMs: setup.setupDurationMs,
				contextUsage: setup.contextUsage,
				contextWindow: setup.contextWindow,
			}))
			setStatus('ready')
		} catch (error) {
			if (operation !== operationRef.current || isAbortError(error)) return
			sessionReadyRef.current = false
			showError(error, 'Chrome could not prepare its local AI model.')
		} finally {
			if (operation === operationRef.current) abortRef.current = null
		}
	}

	const armSetupWatchdog = (operation: number, controller: AbortController) => {
		if (setupWatchdogRef.current) clearTimeout(setupWatchdogRef.current)
		setupWatchdogRef.current = setTimeout(() => {
			if (operation !== operationRef.current) return
			operationRef.current += 1
			controller.abort()
			abortRef.current = null
			setupWatchdogRef.current = null
			sessionReadyRef.current = false
			setStatus('error')
			setErrorMessage("Local AI couldn't become ready on this browser or device.")
			setMetrics((current) => ({
				...current,
				sessionStatus: 'error',
				result: 'failure',
			}))
		}, setupWatchdogMs)
	}

	const run = async () => {
		if (!content.trim()) return

		const operation = ++operationRef.current
		const controller = new AbortController()
		abortRef.current = controller
		const source = content
		setOriginal(source)
		setSuggestion('')
		setErrorMessage('')
		setIsSlow(false)
		setStatus('running')
		setMetrics((current) => ({
			...current,
			sessionStatus: 'generating',
			inputCharacters: source.length,
			outputCharacters: 0,
		}))
		slowTimerRef.current = setTimeout(() => setIsSlow(true), 5000)

		try {
			const result = await cleanupMarkdown(provider, source, {
				signal: controller.signal,
				onUpdate: (partial) => schedulePartialUpdate(partial, operation),
			})
			if (operation !== operationRef.current) return
			clearTimers()
			setSuggestion(validateCleanupOutput(result.markdown))
			setMetrics((current) => ({
				...current,
				sessionStatus: 'ready',
				generationDurationMs: result.generationDurationMs,
				outputCharacters: result.markdown.length,
				contextUsage: result.contextUsage,
				contextWindow: result.contextWindow,
				result: 'success',
			}))
			setStatus('ready')
		} catch (error) {
			if (operation !== operationRef.current || isAbortError(error)) return
			clearTimers()
			setSuggestion('')
			showError(error, 'Local AI could not clean up this document.')
		} finally {
			if (operation === operationRef.current) abortRef.current = null
		}
	}

	const apply = () => {
		if (status !== 'ready' || !suggestion) return
		if (content !== original) {
			showError(
				new Error(
					'The document changed while AI was running. Review again before applying.',
				),
				'',
			)
			return
		}

		onApply(suggestion)
		setIsOpen(false)
		setOriginal('')
		setSuggestion('')
		triggerRef.current?.focus()
	}

	const showError = (error: unknown, fallback: string) => {
		setStatus('error')
		setErrorMessage(error instanceof Error && error.message ? error.message : fallback)
		setMetrics((current) => ({
			...current,
			sessionStatus: sessionReadyRef.current ? 'ready' : 'error',
			result: 'failure',
		}))
	}

	const schedulePartialUpdate = (partial: string, operation: number) => {
		pendingPartialRef.current = partial
		if (partialUpdateRef.current) return
		partialUpdateRef.current = setTimeout(() => {
			partialUpdateRef.current = null
			if (operation === operationRef.current) setSuggestion(pendingPartialRef.current)
		}, 50)
	}

	const hasReview = original !== '' && (status === 'running' || suggestion !== '')

	return (
		<>
			<button
				type="button"
				ref={triggerRef}
				className="toolbar-menu-trigger ai-cleanup-trigger"
				disabled={!content.trim()}
				onClick={open}
				aria-label="AI Clean Up"
				title="AI Clean Up"
			>
				AI
			</button>
			{isOpen
				? createPortal(
						<div
							className="ai-review-backdrop"
							onMouseDown={(event) => {
								if (event.target === event.currentTarget) cancel()
							}}
						>
							<section
								className="ai-review-dialog"
								role="dialog"
								aria-modal="true"
								aria-labelledby={headingId}
								onKeyDown={(event) => {
									if (event.key === 'Escape') cancel()
								}}
							>
								<header className="ai-review-header">
									<div>
										<h2 id={headingId}>AI Clean Up</h2>
										<p>
											Experimental · Chrome built-in AI · local to this device
										</p>
									</div>
									<button
										type="button"
										ref={closeButtonRef}
										onClick={cancel}
										aria-label="Cancel AI Clean Up"
									>
										×
									</button>
								</header>
								<div className="ai-review-body">
									{hasReview ? renderReview() : renderSetup()}
								</div>
							</section>
						</div>,
						document.body,
					)
				: null}
		</>
	)

	function renderReview() {
		return (
			<>
				<p className="ai-generation-status" role="status">
					{status === 'running'
						? isSlow
							? 'Still working locally…'
							: 'Generating suggestion…'
						: 'Suggestion ready for review.'}
				</p>
				<div className="ai-review-columns">
					<section>
						<h3>Original</h3>
						<pre aria-label="Original Markdown">{original}</pre>
					</section>
					<section>
						<h3>Suggestion</h3>
						<pre aria-label="AI suggestion">
							{suggestion || (status === 'running' ? 'Generating…' : '')}
							{status === 'running' ? (
								<span className="ai-stream-cursor" aria-hidden="true">
									{' '}
									▌
								</span>
							) : null}
						</pre>
					</section>
				</div>
				<div className="ai-review-actions">
					<button type="button" onClick={cancel}>
						Cancel
					</button>
					<button
						type="button"
						onClick={apply}
						disabled={status !== 'ready' || !suggestion}
					>
						Apply
					</button>
				</div>
				<DevelopmentMetrics metrics={metrics} />
			</>
		)
	}

	function renderSetup() {
		if (status === 'unsupported' || status === 'unavailable') {
			return <p>Local AI isn't available in this browser or device yet.</p>
		}
		if (status === 'checking') return <p role="status">Checking local AI availability…</p>

		return (
			<>
				{status === 'error' ? <p role="alert">{errorMessage}</p> : null}
				{status === 'preparing' ? <p role="status">Preparing local AI…</p> : null}
				{status === 'downloadable' || status === 'downloading' || status === 'preparing' ? (
					<>
						<p>
							AI runs privately on this device. Chrome may need to download its local
							AI model before first use.
						</p>
						{downloadProgress !== null ? (
							<label className="ai-download-progress">
								<span>Model setup {Math.round(downloadProgress * 100)}%</span>
								<progress max={1} value={downloadProgress} />
							</label>
						) : null}
					</>
				) : status !== 'error' ? (
					<p>The suggestion will not change your document until you choose Apply.</p>
				) : null}
				<div className="ai-review-actions">
					<button type="button" onClick={cancel}>
						Cancel
					</button>
					{status === 'ready' ? (
						<button type="button" onClick={run}>
							Run Clean Up
						</button>
					) : status === 'error' && sessionReadyRef.current ? (
						<button type="button" onClick={run}>
							Try Again
						</button>
					) : (
						<button type="button" onClick={enable} disabled={status === 'preparing'}>
							{status === 'preparing'
								? 'Preparing…'
								: status === 'error'
									? 'Try Again'
									: 'Enable AI'}
						</button>
					)}
				</div>
				<DevelopmentMetrics metrics={metrics} />
			</>
		)
	}
}

function DevelopmentMetrics({ metrics }: { metrics: POCMetrics }) {
	if (!import.meta.env.DEV) return null

	return (
		<details className="ai-poc-metrics">
			<summary>POC metrics</summary>
			<dl>
				{Object.entries(metrics).map(([key, value]) => (
					<div key={key}>
						<dt>{key}</dt>
						<dd>{typeof value === 'number' ? Math.round(value) : value}</dd>
					</div>
				))}
			</dl>
		</details>
	)
}

function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === 'AbortError'
}
