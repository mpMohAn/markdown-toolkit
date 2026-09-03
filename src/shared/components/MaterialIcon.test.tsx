import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import imageIconUrl from '../../assets/icons/material/image.svg'
import { MaterialIcon } from './MaterialIcon'

describe('MaterialIcon', () => {
	it('renders a local decorative SVG mask hidden from assistive technology', () => {
		const { container } = render(<MaterialIcon name="formatBold" />)
		const icon = container.querySelector('.material-icon')

		expect(icon).toHaveClass('material-icon')
		expect(icon).toHaveAttribute('aria-hidden', 'true')
		expect(icon?.getAttribute('style')).toContain('data:image/svg+xml')
		expect(icon?.getAttribute('style')).not.toMatch(/fonts\.(?:googleapis|gstatic)\.com/)
		expect(container.querySelector('svg, img, use')).not.toBeInTheDocument()
	})

	it('uses the curated local Material image asset', () => {
		const { container } = render(<MaterialIcon name="image" />)

		expect(container.querySelector('.material-icon')?.getAttribute('style')).toContain(
			imageIconUrl,
		)
	})
})
