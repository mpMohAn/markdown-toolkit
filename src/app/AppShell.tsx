import { ThemeToggle } from '../features/theme/ThemeToggle'
import { useTheme } from '../features/theme/useTheme'
import { SkipLink } from '../shared/components/SkipLink'

export function AppShell() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="app-shell" data-theme={theme}>
      <SkipLink targetId="main-content" />
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="Markdown Toolkit home">
          Markdown Toolkit
        </a>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </header>

      <main className="app-main" id="main-content" tabIndex={-1}>
        <section className="workspace-intro" aria-labelledby="workspace-title">
          <p className="eyebrow">Local-first Markdown workspace</p>
          <h1 id="workspace-title">A focused place for your writing.</h1>
          <p className="workspace-description">
            The editor and preview experience is being prepared.
          </p>
        </section>
      </main>

      <footer className="app-footer">
        <p>Private by default. Your work will stay in this browser.</p>
        <p aria-live="polite">Foundation ready</p>
      </footer>
    </div>
  )
}
