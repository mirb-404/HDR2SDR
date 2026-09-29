import { AUTHOR } from '../siteConfig'

export default function Footer() {
  return (
    <footer
      className="border-t mt-10 sm:mt-16"
      style={{ borderColor: 'var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-7 space-y-5">

        {/* Attribution */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-center sm:text-left" style={{ color: 'var(--text-secondary)' }}>
            Built by{' '}
            <a
              href={AUTHOR.profileUrl}
              target="_blank"
              rel="noopener noreferrer me"
              className="font-semibold hover:underline"
              style={{ color: 'var(--text-primary)' }}
            >
              {AUTHOR.name}
            </a>
            <span style={{ color: 'var(--text-muted)' }}> · free, open source, no strings</span>
          </p>

          <div className="flex items-center gap-2">
            <a
              href={AUTHOR.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-secondary)', minHeight: '40px' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.6 9.6 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 22 12c0-5.52-4.48-10-10-10z"/>
              </svg>
              Source on GitHub
            </a>
            <a
              href={AUTHOR.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-secondary)', minHeight: '40px' }}
            >
              @{AUTHOR.githubUser}
            </a>
          </div>
        </div>

        {/* Technical line */}
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-3 gap-y-1 text-xs pt-4 border-t"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          <a href="#privacy" className="hover:underline" style={{ color: 'var(--accent-light)' }}>
            Privacy
          </a>
          <span aria-hidden="true">·</span>
          <a href="https://ffmpeg.org/documentation.html" target="_blank" rel="noopener noreferrer"
            className="hover:underline" style={{ color: 'var(--accent-light)' }}>
            FFmpeg docs ↗
          </a>
          <span aria-hidden="true">·</span>
          <span>Hable tone mapping</span>
          <span aria-hidden="true">·</span>
          <span>H.264 / BT.709 output</span>
          <span aria-hidden="true">·</span>
          <span>MIT licensed</span>
        </div>

        <p className="text-xs text-center sm:text-left" style={{ color: 'var(--text-muted)' }}>
          No accounts · No cookies · No analytics · Your files are deleted automatically
        </p>
      </div>
    </footer>
  )
}
