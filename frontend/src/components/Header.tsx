import { AUTHOR } from '../siteConfig'

export default function Header() {
  return (
    <header
      className="border-b sticky top-0 z-30"
      style={{
        borderColor: 'var(--border)',
        background: 'rgba(10,10,15,0.85)',
        backdropFilter: 'blur(12px)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
        {/* Logo */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.9"/>
              <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6"/>
              <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.4"/>
            </svg>
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-base tracking-tight" style={{ color: 'var(--text-primary)' }}>
              HDR<span style={{ color: 'var(--accent-light)' }}>2</span>SDR
            </h1>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>FFmpeg Tone Mapper</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* The privacy claim is the thing worth saying up front, so it keeps
              its place on a phone while the FFmpeg badge drops away. */}
          <a
            href="#privacy"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#34d399' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
            <span className="whitespace-nowrap">No data stored</span>
          </a>

          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: 'var(--accent-light)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent-light)' }}></span>
            Powered by FFmpeg
          </div>

          <a
            href={AUTHOR.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View the source on GitHub"
            className="hidden sm:flex w-9 h-9 rounded-lg items-center justify-center transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 22 12c0-5.52-4.48-10-10-10z"/>
            </svg>
          </a>
        </div>
      </div>
    </header>
  )
}
