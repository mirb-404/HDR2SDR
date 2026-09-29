import { AUTHOR } from '../siteConfig'

/**
 * The mark is a square split down the middle: the left half is the blown out
 * orange this tool takes in, the right half the settled navy it gives back.
 * The whole product in one glyph.
 */
function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className="relative w-8 h-8 rounded-[9px] overflow-hidden flex-shrink-0"
        style={{ background: 'var(--navy)' }}
        aria-hidden="true"
      >
        <span
          className="absolute inset-y-0 left-0 w-1/2"
          style={{ background: 'var(--brand)' }}
        />
        <span
          className="absolute inset-0 flex items-center justify-center text-white font-black"
          style={{ fontSize: '13px', letterSpacing: '-0.04em' }}
        >
          HS
        </span>
      </span>
      <span className="font-extrabold text-[17px] tracking-tight" style={{ color: 'var(--text)' }}>
        HDR<span style={{ color: 'var(--brand)' }}>2</span>SDR
      </span>
    </span>
  )
}

export default function Header() {
  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-4">
        <a href="/" aria-label="HDR2SDR home">
          <Logo />
        </a>

        <nav className="flex items-center gap-1 sm:gap-2 text-sm font-medium">
          <a
            href="#how"
            className="hidden sm:inline-block px-3 py-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-2)' }}
          >
            How it works
          </a>
          <a
            href="#privacy"
            className="px-3 py-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-2)' }}
          >
            Privacy
          </a>
          <a
            href={AUTHOR.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-2)' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 015 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0022 12c0-5.52-4.48-10-10-10z"/>
            </svg>
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </nav>
      </div>
    </header>
  )
}
