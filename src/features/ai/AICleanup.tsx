import { useEffect, useId, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AIAvailability, AIProvider, AIProviderErrorCode } from './AIProvider'
import { AIProviderError, isAIProviderError } from './AIProvider'
import { readAIEnabledPreference, writeAIEnabledPreference } from './aiPreferences'
import { ChromeBuiltInAIProvider } from './chromeBuiltInAIProvider'
import { cleanupMarkdown, MARKDOWN_CLEANUP_SYSTEM_PROMPT } from './markdownCleanup'

type PassiveState = Exclude<AIAvailability, never>
type ReviewState = {
	source: string
	suggestion: string
}

type AIState =
	| { status: 'checking' }
	| { status: PassiveState }
	| {
			status: 'preparing'
			phase: 'indeterminate' | 'downloading' | 'finalizing'
			progress: number | null
	  }
	| { status: 'ready' }
	| ({ status: 'running'; slow: boolean } & ReviewState)
	| ({ status: 'review' } & ReviewState)
	| ({ status: 'stale-review'; reason: string } & ReviewState)
	| {
			status: 'error'
			message: string
			retry: 'availability' | 'setup' | 'generation'
			code: AIProviderErrorCode
	  }

type AIAction =
	| { type: 'checking' }
	| { type: 'availability'; availability: AIAvailability }
	| { type: 'preparing' }
	| { type: 'progress'; progress: number }
	| { type: 'ready' }
	| { type: 'running'; source: string }
	| { type: 'partial'; suggestion: string }
	| { type: 'slow' }
	| { type: 'review'; suggestion: string }
	| { type: 'stale'; reason: string }
	| {
			type: 'error'
			message: string
			retry: 'availability' | 'setup' | 'generation'
			code: AIProviderErrorCode
	  }

interface POCMetrics {
	availability?: AIAvailability
	sessionStatus?: 'not-ready' | 'ready' | 'generating' | 'error'
	setupDurationMs?: number
	generationDurationMs?: number
	inputCharacters?: number
	outputCharacters?: number
	contextUsage?: number
	contextWindow?: number
	downloadProgressPercent?: number
	result?: 'success' | 'failure' | 'cancelled'
	errorCategory?: AIProviderErrorCode
}

interface AICleanupProps {
	content: string
	onApply: (content: string) => void
	provider?: AIProvider
	providerFactory?: () => AIProvider
	availabilityWatchdogMs?: number
	setupWatchdogMs?: number
}

const DEFAULT_AVAILABILITY_WATCHDOG_MS = 4_000
const DEFAULT_SETUP_WATCHDOG_MS = 40_000
const STALE_MESSAGE =
	'The document changed after this cleanup started. Regenerate from the current document.'

export function AICleanup({
	content,
	onApply,
	provider: providedProvider,
	providerFactory: providedProviderFactory,
	availabilityWatchdogMs = DEFAULT_AVAILABILITY_WATCHDOG_MS,
	setupWatchdogMs = DEFAULT_SETUP_WATCHDOG_MS,
}: AICleanupProps) {
	const [isOpen, setIsOpen] = useState(false)
	const [state, dispatch] = useReducer(aiReducer, { status: 'checking' })
	const [metrics, setMetrics] = useState<POCMetrics>({ sessionStatus: 'not-ready' })
	const stateRef = useRef(state)
	const providerFactoryRef = useRef<() => AIProvider>(
		providedProviderFactory ??
			(providedProvider ? () => providedProvider : () => new ChromeBuiltInAIProvider()),
	)
	const providerRef = useRef<AIProvider | null>(null)
	const rememberedEnablementRef = useRef(readAIEnabledPreference())
	const mountedRef = useRef(false)
	const operationRef = useRef(0)
	const operationKindRef = useRef<'availability' | 'setup' | 'generation' | null>(null)
	const abortRef = useRef<AbortController | null>(null)
	const partialUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const pendingPartialRef = useRef('')
	const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const availabilityWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const setupWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const setupProgressRef = useRef<number | null>(null)
	const availabilityRef = useRef<AIAvailability>('unsupported')
	const headingId = useId()
	const dialogRef = useRef<HTMLElement>(null)
	const closeButtonRef = useRef<HTMLButtonElement>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const openRef = useRef(false)

	stateRef.current = state
	openRef.current = isOpen

	useEffect(() => {
		const lifecycleProvider = providerFactoryRef.current()
		mountedRef.current = true
		providerRef.current = lifecycleProvider
		operationKindRef.current = null

		return () => {
			mountedRef.current = false
			operationRef.current += 1
			abortRef.current?.abort()
			abortRef.current = null
			operationKindRef.current = null
			clearTimers()
			if (providerRef.current === lifecycleProvider) providerRef.current = null
			lifecycleProvider.dispose()
		}
		// The factory is captured once so each Strict Mode effect lifecycle owns one provider.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	useEffect(() => {
		if ((state.status === 'running' || state.status === 'review') && content !== state.source) {
			if (state.status === 'running') invalidateOperation()
			dispatch({ type: 'stale', reason: STALE_MESSAGE })
		}
	}, [content, state])

	useEffect(() => {
		if (!isOpen) return
		const trigger = triggerRef.current
		const background = trigger?.closest<HTMLElement>('.app-shell') ?? null
		const wasInert = background ? background.inert || background.hasAttribute('inert') : false
		if (background) {
			background.inert = true
			background.setAttribute('inert', '')
		}

		const focusInitial = () => closeButtonRef.current?.focus()
		focusInitial()
		const onDocumentKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				event.preventDefault()
				cancel()
			}
		}
		const onFocusIn = (event: FocusEvent) => {
			if (!dialogRef.current?.contains(event.target as Node)) focusInitial()
		}
		document.addEventListener('keydown', onDocumentKeyDown)
		document.addEventListener('focusin', onFocusIn)

		return () => {
			document.removeEventListener('keydown', onDocumentKeyDown)
			document.removeEventListener('focusin', onFocusIn)
			if (background) {
				background.inert = wasInert
				if (wasInert) background.setAttribute('inert', '')
				else background.removeAttribute('inert')
			}
			if (mountedRef.current) trigger?.focus()
		}
		// cancel uses refs specifically so these listeners do not churn with state.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen])

	function clearTimers() {
		if (partialUpdateRef.current) clearTimeout(partialUpdateRef.current)
		if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
		if (availabilityWatchdogRef.current) clearTimeout(availabilityWatchdogRef.current)
		if (setupWatchdogRef.current) clearTimeout(setupWatchdogRef.current)
		partialUpdateRef.current = null
		slowTimerRef.current = null
		availabilityWatchdogRef.current = null
		setupWatchdogRef.current = null
		pendingPartialRef.current = ''
	}

	function invalidateOperation() {
		operationRef.current += 1
		abortRef.current?.abort()
		abortRef.current = null
		operationKindRef.current = null
		clearTimers()
	}

	function beginOperation(kind: 'availability' | 'setup' | 'generation'): {
		id: number
		controller: AbortController
	} {
		invalidateOperation()
		const controller = new AbortController()
		const id = operationRef.current
		abortRef.current = controller
		operationKindRef.current = kind
		return { id, controller }
	}

	function isCurrent(id: number, controller: AbortController): boolean {
		return mountedRef.current && id === operationRef.current && !controller.signal.aborted
	}

	async function checkAvailability() {
		if (operationKindRef.current) return
		const provider = providerRef.current
		if (!provider) return
		const operation = beginOperation('availability')
		dispatch({ type: 'checking' })
		armAvailabilityWatchdog(operation)
		try {
			const availability = await provider.getAvailability()
			if (!isCurrent(operation.id, operation.controller)) return
			clearTimers()
			availabilityRef.current = availability
			dispatch({ type: 'availability', availability })
			setMetrics((current) => ({ ...current, availability }))
			if (
				rememberedEnablementRef.current &&
				openRef.current &&
				canPrepareFrom(availability)
			) {
				abortRef.current = null
				operationKindRef.current = null
				void enable()
			}
		} catch (error) {
			if (!isCurrent(operation.id, operation.controller)) return
			clearTimers()
			showControlledError(error, 'availability')
		} finally {
			if (isCurrent(operation.id, operation.controller)) {
				abortRef.current = null
				operationKindRef.current = null
			}
		}
	}

	function armAvailabilityWatchdog(operation: { id: number; controller: AbortController }) {
		if (!isCurrent(operation.id, operation.controller)) return
		if (availabilityWatchdogRef.current) clearTimeout(availabilityWatchdogRef.current)
		availabilityWatchdogRef.current = setTimeout(() => {
			if (!isCurrent(operation.id, operation.controller)) return
			invalidateOperation()
			showControlledError(new AIProviderError('AVAILABILITY_CHECK_FAILED'), 'availability')
		}, availabilityWatchdogMs)
	}

	function open() {
		if (openRef.current || !content.trim()) return
		openRef.current = true
		setIsOpen(true)
		const current = stateRef.current
		if (
			current.status === 'checking' ||
			(current.status === 'error' && current.retry === 'availability')
		) {
			void checkAvailability()
		} else if (rememberedEnablementRef.current && canPrepareFrom(current.status)) {
			void enable()
		}
	}

	function cancel() {
		if (!openRef.current) return
		const current = stateRef.current
		const hadReadySession =
			current.status === 'ready' ||
			current.status === 'running' ||
			current.status === 'review' ||
			current.status === 'stale-review' ||
			(current.status === 'error' && current.retry === 'generation')
		openRef.current = false
		invalidateOperation()
		if (hadReadySession) {
			dispatch({ type: 'ready' })
		} else if (current.status === 'checking') {
			dispatch({
				type: 'error',
				code: 'AVAILABILITY_CHECK_FAILED',
				message: getErrorMessage('AVAILABILITY_CHECK_FAILED', 'availability'),
				retry: 'availability',
			})
		} else if (
			current.status === 'preparing' ||
			(current.status === 'error' && current.retry === 'setup')
		) {
			dispatch({ type: 'availability', availability: availabilityRef.current })
		}
		setMetrics((current) => ({ ...current, result: 'cancelled' }))
		setIsOpen(false)
	}

	async function enable() {
		if (operationKindRef.current) return
		const provider = providerRef.current
		if (!provider) return
		const current = stateRef.current
		if (
			current.status === 'preparing' ||
			current.status === 'running' ||
			current.status === 'review'
		) {
			return
		}
		const operation = beginOperation('setup')
		setupProgressRef.current = null
		dispatch({ type: 'preparing' })
		armSetupWatchdog(operation)
		try {
			const setup = await provider.initialize(MARKDOWN_CLEANUP_SYSTEM_PROMPT, {
				signal: operation.controller.signal,
				onDownloadProgress: (progress) => {
					if (!isCurrent(operation.id, operation.controller)) return
					if (setupProgressRef.current === null || progress > setupProgressRef.current) {
						setupProgressRef.current = progress
						dispatch({ type: 'progress', progress })
						setMetrics((currentMetrics) => ({
							...currentMetrics,
							downloadProgressPercent: progress * 100,
						}))
						armSetupWatchdog(operation)
					}
				},
			})
			if (!isCurrent(operation.id, operation.controller)) return
			clearTimers()
			writeAIEnabledPreference()
			rememberedEnablementRef.current = true
			dispatch({ type: 'ready' })
			setMetrics((currentMetrics) => ({
				...currentMetrics,
				sessionStatus: 'ready',
				setupDurationMs: setup.setupDurationMs,
				contextUsage: setup.contextUsage,
				contextWindow: setup.contextWindow,
				errorCategory: undefined,
			}))
		} catch (error) {
			if (!isCurrent(operation.id, operation.controller)) return
			clearTimers()
			showControlledError(error, 'setup')
		} finally {
			if (isCurrent(operation.id, operation.controller)) {
				abortRef.current = null
				operationKindRef.current = null
			}
		}
	}

	function armSetupWatchdog(operation: { id: number; controller: AbortController }) {
		if (!isCurrent(operation.id, operation.controller)) return
		if (setupWatchdogRef.current) clearTimeout(setupWatchdogRef.current)
		setupWatchdogRef.current = setTimeout(() => {
			if (!isCurrent(operation.id, operation.controller)) return
			invalidateOperation()
			showControlledError(new AIProviderError('SETUP_STALLED'), 'setup')
		}, setupWatchdogMs)
	}

	async function run() {
		if (operationKindRef.current) return
		const provider = providerRef.current
		if (!provider) return
		const current = stateRef.current
		if (
			current.status !== 'ready' &&
			current.status !== 'stale-review' &&
			!(current.status === 'error' && current.retry === 'generation')
		) {
			return
		}
		if (!content.trim()) {
			dispatch({
				type: 'error',
				code: 'EMPTY_OUTPUT',
				message: 'There is no Markdown to clean up.',
				retry: 'generation',
			})
			return
		}

		const operation = beginOperation('generation')
		const source = content
		dispatch({ type: 'running', source })
		setMetrics((currentMetrics) => ({
			...currentMetrics,
			sessionStatus: 'generating',
			inputCharacters: source.length,
			outputCharacters: 0,
			result: undefined,
			errorCategory: undefined,
		}))
		slowTimerRef.current = setTimeout(() => {
			if (isCurrent(operation.id, operation.controller)) dispatch({ type: 'slow' })
		}, 5000)

		try {
			const result = await cleanupMarkdown(provider, source, {
				signal: operation.controller.signal,
				onUpdate: (partial) => schedulePartialUpdate(partial, operation),
			})
			if (!isCurrent(operation.id, operation.controller)) return
			clearTimers()
			dispatch({ type: 'review', suggestion: result.markdown })
			setMetrics((currentMetrics) => ({
				...currentMetrics,
				sessionStatus: 'ready',
				generationDurationMs: result.generationDurationMs,
				outputCharacters: result.markdown.length,
				contextUsage: result.contextUsage,
				contextWindow: result.contextWindow,
				result: 'success',
			}))
		} catch (error) {
			if (!isCurrent(operation.id, operation.controller)) return
			clearTimers()
			showControlledError(error, 'generation')
		} finally {
			if (isCurrent(operation.id, operation.controller)) {
				abortRef.current = null
				operationKindRef.current = null
			}
		}
	}

	function apply() {
		if (!openRef.current || operationKindRef.current) return
		const current = stateRef.current
		if (current.status !== 'review' || !current.suggestion) return
		if (content !== current.source) {
			dispatch({ type: 'stale', reason: STALE_MESSAGE })
			return
		}
		openRef.current = false
		onApply(current.suggestion)
		dispatch({ type: 'ready' })
		setIsOpen(false)
	}

	function showControlledError(error: unknown, phase: 'availability' | 'setup' | 'generation') {
		const code = isAIProviderError(error) ? error.code : 'GENERATION_FAILED'
		const retry =
			phase === 'availability' ? 'availability' : code === 'SESSION_EXPIRED' ? 'setup' : phase
		dispatch({ type: 'error', code, message: getErrorMessage(code, phase), retry })
		setMetrics((current) => ({
			...current,
			sessionStatus: retry === 'generation' ? 'ready' : 'error',
			result: 'failure',
			errorCategory: code,
		}))
	}

	function schedulePartialUpdate(
		partial: string,
		operation: { id: number; controller: AbortController },
	) {
		if (!isCurrent(operation.id, operation.controller)) return
		pendingPartialRef.current = partial
		if (partialUpdateRef.current) return
		partialUpdateRef.current = setTimeout(() => {
			partialUpdateRef.current = null
			if (isCurrent(operation.id, operation.controller)) {
				dispatch({ type: 'partial', suggestion: pendingPartialRef.current })
			}
		}, 50)
	}

	const hasReview =
		state.status === 'running' || state.status === 'review' || state.status === 'stale-review'
	const emptyCurrentDocument = !content.trim()

	return (
		<>
			<button
				type="button"
				ref={triggerRef}
				className="toolbar-menu-trigger ai-cleanup-trigger"
				disabled={emptyCurrentDocument}
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
								ref={dialogRef}
								className="ai-review-dialog"
								role="dialog"
								aria-modal="true"
								aria-labelledby={headingId}
								onKeyDown={trapDialogTab}
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

	function trapDialogTab(event: React.KeyboardEvent<HTMLElement>) {
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

	function renderReview() {
		const reviewState = state as Extract<
			AIState,
			{ status: 'running' | 'review' | 'stale-review' }
		>
		return (
			<>
				{state.status === 'stale-review' ? (
					<p className="ai-generation-status" role="alert">
						{state.reason}
					</p>
				) : (
					<p className="ai-generation-status" role="status">
						{state.status === 'running'
							? state.slow
								? 'Still working locally…'
								: 'Generating suggestion…'
							: 'Suggestion ready for review.'}
					</p>
				)}
				{emptyCurrentDocument && state.status === 'stale-review' ? (
					<p role="alert">Add Markdown before regenerating.</p>
				) : null}
				<div className="ai-review-columns">
					<section>
						<h3>Original</h3>
						<pre aria-label="Original Markdown">{reviewState.source}</pre>
					</section>
					<section>
						<h3>Suggestion</h3>
						<pre aria-label="AI suggestion">
							{reviewState.suggestion ||
								(state.status === 'running' ? 'Generating…' : '')}
							{state.status === 'running' ? (
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
					{state.status === 'stale-review' ? (
						<button type="button" onClick={run} disabled={emptyCurrentDocument}>
							Regenerate
						</button>
					) : (
						<button
							type="button"
							onClick={apply}
							disabled={state.status !== 'review' || !reviewState.suggestion}
						>
							Apply
						</button>
					)}
				</div>
				<DevelopmentMetrics metrics={metrics} />
			</>
		)
	}

	function renderSetup() {
		if (state.status === 'unsupported') {
			return <p>Local AI isn't available in this browser or device yet.</p>
		}
		if (state.status === 'unavailable') {
			return <p>Chrome's local AI model is unavailable on this device.</p>
		}
		if (state.status === 'checking') {
			return <p role="status">Checking local AI availability…</p>
		}
		const progress = state.status === 'preparing' ? state.progress : null
		return (
			<>
				{state.status === 'error' ? <p role="alert">{state.message}</p> : null}
				{state.status === 'preparing' ? (
					<p role="status">
						{state.phase === 'downloading' && progress !== null
							? `Downloading local AI model — ${Math.round(progress * 100)}%`
							: state.phase === 'finalizing'
								? 'Finalizing local AI session…'
								: 'Preparing local AI…'}
					</p>
				) : null}
				{emptyCurrentDocument ? (
					<p role="alert">Add Markdown before running AI Clean Up.</p>
				) : null}
				{state.status === 'downloadable' ||
				state.status === 'downloading' ||
				state.status === 'preparing' ? (
					<>
						<p>
							AI runs privately on this device. Chrome may need to download its local
							AI model before first use.
						</p>
						{state.status === 'preparing' &&
						state.phase === 'downloading' &&
						progress !== null ? (
							<label className="ai-progress">
								<span>Local AI model download</span>
								<progress
									className="ai-progress__bar ai-progress__bar--determinate"
									aria-label="Local AI model download progress"
									aria-valuemin={0}
									aria-valuemax={100}
									aria-valuenow={progress * 100}
									max={100}
									value={progress * 100}
								/>
							</label>
						) : state.status === 'preparing' ? (
							<div className="ai-progress">
								<span>
									{state.phase === 'finalizing'
										? 'Chrome is finalizing the local AI session.'
										: 'Waiting for measurable browser progress.'}
								</span>
								<progress
									className="ai-progress__bar ai-progress__bar--indeterminate"
									aria-label="Local AI preparation in progress"
								/>
							</div>
						) : null}
					</>
				) : state.status !== 'error' ? (
					<p>The suggestion will not change your document until you choose Apply.</p>
				) : null}
				<div className="ai-review-actions">
					<button type="button" onClick={cancel}>
						Cancel
					</button>
					{state.status === 'ready' ? (
						<button type="button" onClick={run} disabled={emptyCurrentDocument}>
							Run Clean Up
						</button>
					) : state.status === 'error' && state.retry === 'availability' ? (
						<button type="button" onClick={() => void checkAvailability()}>
							Retry
						</button>
					) : state.status === 'error' && state.retry === 'generation' ? (
						<button type="button" onClick={run} disabled={emptyCurrentDocument}>
							Try Again
						</button>
					) : (
						<button
							type="button"
							onClick={enable}
							disabled={state.status === 'preparing'}
						>
							{state.status === 'preparing'
								? 'Preparing…'
								: state.status === 'error'
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

function aiReducer(state: AIState, action: AIAction): AIState {
	switch (action.type) {
		case 'checking':
			return { status: 'checking' }
		case 'availability':
			return { status: action.availability }
		case 'preparing':
			return { status: 'preparing', phase: 'indeterminate', progress: null }
		case 'progress':
			return state.status === 'preparing'
				? action.progress >= 1
					? { ...state, phase: 'finalizing', progress: action.progress }
					: { ...state, phase: 'downloading', progress: action.progress }
				: state
		case 'ready':
			return { status: 'ready' }
		case 'running':
			return { status: 'running', source: action.source, suggestion: '', slow: false }
		case 'partial':
			return state.status === 'running' ? { ...state, suggestion: action.suggestion } : state
		case 'slow':
			return state.status === 'running' ? { ...state, slow: true } : state
		case 'review':
			return state.status === 'running'
				? { status: 'review', source: state.source, suggestion: action.suggestion }
				: state
		case 'stale':
			return state.status === 'running' || state.status === 'review'
				? {
						status: 'stale-review',
						source: state.source,
						suggestion: state.suggestion,
						reason: action.reason,
					}
				: state
		case 'error':
			return {
				status: 'error',
				message: action.message,
				retry: action.retry,
				code: action.code,
			}
	}
}

function getErrorMessage(
	code: AIProviderErrorCode,
	phase: 'availability' | 'setup' | 'generation',
): string {
	if (code === 'GENERATION_FAILED' && phase === 'setup') {
		return 'Chrome could not prepare its local AI model. Try again.'
	}
	switch (code) {
		case 'UNSUPPORTED':
			return "Local AI isn't available in this browser or device yet."
		case 'UNAVAILABLE':
			return "Chrome's local AI model is unavailable on this device."
		case 'AVAILABILITY_CHECK_FAILED':
			return 'Local AI availability could not be checked. Try again.'
		case 'SESSION_EXPIRED':
			return 'The local AI session expired. Prepare it again to continue.'
		case 'SETUP_STALLED':
			return "Local AI couldn't become ready on this browser or device."
		case 'OPERATION_CANCELLED':
			return 'The local AI operation was cancelled.'
		case 'INPUT_TOO_LARGE':
			return 'This document is too large for the available local AI context.'
		case 'CONTEXT_MEASUREMENT_UNAVAILABLE':
			return 'This local AI version cannot safely measure the complete document context.'
		case 'EMPTY_OUTPUT':
			return 'Local AI returned no usable Markdown suggestion.'
		case 'GENERATION_FAILED':
			return 'Local AI could not clean up this document. Try again.'
	}
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(
		container.querySelectorAll<HTMLElement>(
			'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
		),
	).filter((element) => !element.hidden)
}

function canPrepareFrom(status: AIState['status']): boolean {
	return status === 'available' || status === 'downloadable' || status === 'downloading'
}

function DevelopmentMetrics({ metrics }: { metrics: POCMetrics }) {
	if (!import.meta.env.DEV) return null
	return (
		<details className="ai-poc-metrics">
			<summary>POC metrics</summary>
			<dl>
				{Object.entries(metrics).map(([key, value]) =>
					value === undefined ? null : (
						<div key={key}>
							<dt>{key}</dt>
							<dd>{typeof value === 'number' ? Math.round(value) : value}</dd>
						</div>
					),
				)}
			</dl>
		</details>
	)
}
