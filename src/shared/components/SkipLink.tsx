interface SkipLinkProps {
	targetId: string
}

export function SkipLink({ targetId }: SkipLinkProps) {
	return (
		<a className="skip-link" href={`#${targetId}`}>
			Skip to main content
		</a>
	)
}
