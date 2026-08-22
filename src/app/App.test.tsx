import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('provides landmarks and a keyboard skip link', () => {
    render(<App />)
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main-content',
    )
  })

  it('switches themes using an accessible button', async () => {
    const user = userEvent.setup()
    render(<App />)
    const button = screen.getByRole('button', { name: /switch to .* theme/i })
    const initialPressed = button.getAttribute('aria-pressed')
    await user.click(button)
    expect(button).toHaveAttribute('aria-pressed', initialPressed === 'true' ? 'false' : 'true')
  })
})
