import { useCallback, useRef, useState } from 'react'
import { AccessibleDialog } from '../../shared/components/AccessibleDialog'
import { MaterialIcon } from '../../shared/components/MaterialIcon'
import { ToolbarMenu } from '../../shared/components/ToolbarMenu'

const REPOSITORY_URL = 'https://github.com/mpMohAn/markdown-toolkit'
const ISSUE_URL = 'https://github.com/mpMohAn/markdown-toolkit/issues/new'
const SPONSORS_URL = 'https://github.com/sponsors/mpMohAn'
const CLOUDFLARE_ANALYTICS_URL = 'https://developers.cloudflare.com/web-analytics/'

type DialogKind = 'about' | 'privacy' | null

export function AboutMenu() {
	const [dialog, setDialog] = useState<DialogKind>(null)
	const triggerRef = useRef<HTMLButtonElement>(null)
	const closeDialog = useCallback(() => setDialog(null), [])

	return (
		<>
			<ToolbarMenu
				id="about"
				label="About Markdown Toolkit"
				menuClassName="toolbar-menu-popover-right about-menu-popover"
				restoreTriggerFocusOnSelect={false}
				triggerRef={triggerRef}
				triggerContent={<MaterialIcon name="info" />}
				items={[
					{
						id: 'about-toolkit',
						label: 'About Markdown Toolkit',
						onSelect: () => setDialog('about'),
					},
					{ id: 'privacy', label: 'Privacy', onSelect: () => setDialog('privacy') },
					{ id: 'separator', type: 'separator' },
					{
						id: 'repository',
						label: 'GitHub repository',
						href: REPOSITORY_URL,
						target: '_blank',
						rel: 'noopener noreferrer',
					},
					{
						id: 'issue',
						label: 'Report an issue',
						href: ISSUE_URL,
						target: '_blank',
						rel: 'noopener noreferrer',
					},
					{
						id: 'support',
						label: 'Support Markdown Toolkit',
						href: SPONSORS_URL,
						target: '_blank',
						rel: 'noopener noreferrer',
					},
				]}
			/>

			{dialog === 'about' ? (
				<AccessibleDialog
					title="Markdown Toolkit"
					onClose={closeDialog}
					restoreFocusRef={triggerRef}
					className="about-dialog"
				>
					<p>
						A private, browser-based Markdown editor with live preview, Mermaid
						diagrams, local exports and optional Chrome built-in AI writing.
					</p>
					<dl className="about-details">
						<div>
							<dt>Version</dt>
							<dd>{__APP_VERSION__}</dd>
						</div>
						<div>
							<dt>Built by</dt>
							<dd>Mohan Pattar</dd>
						</div>
					</dl>
					<p>
						<a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
							GitHub repository
						</a>
					</p>
				</AccessibleDialog>
			) : null}

			{dialog === 'privacy' ? (
				<AccessibleDialog
					title="Privacy"
					onClose={closeDialog}
					restoreFocusRef={triggerRef}
					className="privacy-dialog"
				>
					<section>
						<h3>Documents</h3>
						<p>
							Markdown is stored locally in your browser for document recovery and
							autosave. Markdown Toolkit has no application server for storing
							documents. Copy and download operations happen locally.
						</p>
					</section>
					<section>
						<h3>Chrome built-in AI</h3>
						<p>
							AI writing is optional and available only when a compatible Chrome
							runtime exposes the built-in AI capability. After you start an AI
							action, Markdown is processed by Chrome&apos;s local AI runtime. Source
							Markdown, prompts and generated suggestions are not stored by Markdown
							Toolkit analytics. Only the separate AI-enabled preference is persisted.
						</p>
					</section>
					<section>
						<h3>Web Analytics</h3>
						<p>
							Cloudflare Web Analytics is used for basic traffic and performance
							measurement. Markdown Toolkit does not intentionally send document text,
							filenames, AI prompts, AI results or editor keystrokes as analytics
							data. No custom feature-click analytics are implemented.
						</p>
						<p>
							<a
								href={CLOUDFLARE_ANALYTICS_URL}
								target="_blank"
								rel="noopener noreferrer"
							>
								Cloudflare Web Analytics documentation
							</a>
						</p>
					</section>
					<section>
						<h3>External content</h3>
						<p>
							Remote images referenced by Markdown may contact their external host
							when rendered or exported. Opening links leaves Markdown Toolkit and
							follows the destination site&apos;s privacy practices.
						</p>
					</section>
					<nav className="privacy-links" aria-label="Privacy resources">
						<a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
							Repository
						</a>
						<a href={SPONSORS_URL} target="_blank" rel="noopener noreferrer">
							GitHub Sponsors
						</a>
					</nav>
				</AccessibleDialog>
			) : null}
		</>
	)
}
