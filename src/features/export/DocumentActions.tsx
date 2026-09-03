import { useState } from 'react'
import { MaterialIcon } from '../../shared/components/MaterialIcon'
import { ToolbarMenu } from '../../shared/components/ToolbarMenu'
import { copyDocument, downloadDocument, type DocumentFormat } from './documentExport'

interface DocumentActionsProps {
	content: string
}

export function DocumentActions({ content }: DocumentActionsProps) {
	const [copyStatus, setCopyStatus] = useState('')
	const handleCopy = async (format: DocumentFormat) => {
		const copied = await copyDocument(content, format)
		setCopyStatus(
			copied ? `${format === 'markdown' ? 'Markdown' : 'HTML'} copied` : 'Copy failed',
		)
	}

	return (
		<div className="document-actions" aria-label="Document actions">
			<ToolbarMenu
				id="copy"
				label="Copy"
				triggerContent={
					<>
						<MaterialIcon name="contentCopy" />
						<span>Copy</span>
						<MaterialIcon name="arrowDropDown" className="toolbar-menu-chevron" />
					</>
				}
				items={[
					{
						id: 'copy-markdown',
						label: 'Copy Markdown',
						content: 'MD',
						onSelect: () => handleCopy('markdown'),
					},
					{
						id: 'copy-html',
						label: 'Copy HTML',
						content: 'HTML',
						onSelect: () => handleCopy('html'),
					},
				]}
			/>
			<ToolbarMenu
				id="download"
				label="Download"
				menuClassName="toolbar-menu-popover-right"
				triggerContent={
					<>
						<MaterialIcon name="download" />
						<span>Download</span>
						<MaterialIcon name="arrowDropDown" className="toolbar-menu-chevron" />
					</>
				}
				items={[
					{
						id: 'download-markdown',
						label: 'Download Markdown',
						content: 'MD',
						onSelect: () => downloadDocument(content, 'markdown'),
					},
					{
						id: 'download-html',
						label: 'Download HTML',
						content: 'HTML',
						onSelect: () => downloadDocument(content, 'html'),
					},
				]}
			/>
			<span className="visually-hidden" role="status">
				{copyStatus}
			</span>
		</div>
	)
}
