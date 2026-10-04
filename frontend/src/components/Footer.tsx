import { AUTHOR } from '../siteConfig'

export default function Footer() {
  return (
    <footer
      style={{
        background: 'var(--bg-alt)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div className="max-w-5xl mx-auto px-5 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <p className="font-extrabold text-[15px] tracking-tight" style={{ color: 'var(--text)' }}>
              HDR<span style={{ color: 'var(--brand)' }}>2</span>SDR
            </p>
            <p className="text-[13px] mt-1.5" style={{ color: 'var(--text-3)' }}>
              Built by{' '}
              <a
                href={AUTHOR.profileUrl}
                target="_blank"
                rel="noopener noreferrer me"
                className="font-medium underline underline-offset-2"
                style={{ color: 'var(--text-2)' }}
              >
                {AUTHOR.name}
              </a>
              . Free and open source.
            </p>
          </div>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] font-medium">
            <a href="#how" style={{ color: 'var(--text-2)' }}>How it works</a>
            <a href="#privacy" style={{ color: 'var(--text-2)' }}>Privacy</a>
            <a href={AUTHOR.repoUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-2)' }}>
              Source code
            </a>
          </nav>
        </div>

        <div className="mt-8 pt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]"
          style={{ borderTop: '1px solid var(--border)', color: 'var(--text-3)' }}>
          <span>No accounts</span>
          <span aria-hidden="true">&middot;</span>
          <span>No cookies</span>
          <span aria-hidden="true">&middot;</span>
          <span>Anonymous visit counts only</span>
          <span aria-hidden="true">&middot;</span>
          <span>Your files are deleted automatically</span>
        </div>
      </div>
    </footer>
  )
}
