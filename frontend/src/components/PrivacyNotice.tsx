import { AUTHOR, type ServerConfig } from '../siteConfig'

interface Props {
  config: ServerConfig
}

/**
 * The privacy section. Every claim here is one the code actually keeps — see
 * backend/server.js, where the upload is unlinked the moment ffmpeg exits and a
 * sweeper deletes anything older than the retention window regardless.
 *
 * Deliberately specific rather than reassuring: "no cookies" is checkable, and
 * the source link lets anyone check it.
 */
export default function PrivacyNotice({ config }: Props) {
  const promises = [
    {
      title: 'Your upload is deleted the second it is converted',
      body: 'Not queued for deletion, not marked for cleanup — unlinked from disk the moment FFmpeg exits, whether the conversion worked or failed.',
    },
    {
      title: 'Your result is deleted as soon as you download it',
      body: `And if you never come back for it, it is erased anyway within ${config.retentionMinutes} minutes. A sweeper runs every minute and takes everything past that deadline, including files left behind by a crash or restart.`,
    },
    {
      title: 'No accounts, no cookies, no analytics',
      body: 'There is no sign-up, no session, no tracking pixel and no third-party script. This page makes zero requests to anyone but this server — the fonts are your system fonts precisely so Google never sees you visited.',
    },
    {
      title: 'Your filename never leaves your browser',
      body: 'The server knows your job as a random ID and nothing else. Your file is stored under that ID, and your browser renames the download afterwards. There is no record to keep.',
    },
    {
      title: 'Nothing is logged',
      body: 'No access log, no IP address on disk, no record that a conversion happened. Your IP is held in memory only, hashed with a key that is regenerated every restart, purely to stop one person hammering the server.',
    },
    {
      title: 'Nobody watches your video',
      body: 'It is passed to FFmpeg and thrown away. No preview is generated, no frame is kept, no human or model ever sees it.',
    },
  ]

  return (
    <div className="glass rounded-2xl overflow-hidden" id="privacy">
      <div className="px-4 sm:px-6 py-4 border-b flex items-start gap-3" style={{ borderColor: 'var(--border)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: '#10b981' }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
            Your data is not collected. At all.
          </h2>
          <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            This is a converter, not a business. There is nothing to monetise and nothing kept.
          </p>
        </div>
      </div>

      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {promises.map(({ title, body }) => (
          <div key={title} className="px-4 sm:px-6 py-3.5 flex gap-3" style={{ borderColor: 'var(--border)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5" style={{ color: '#10b981' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 sm:px-6 py-4 border-t" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Do not take any of this on trust — the whole thing is open source.{' '}
          <a href={AUTHOR.repoUrl} target="_blank" rel="noopener noreferrer"
            className="hover:underline font-medium" style={{ color: 'var(--accent-light)' }}>
            Read the server code ↗
          </a>{' '}
          and check that it does what this page says. If you would rather not upload anything
          at all, the README shows the exact FFmpeg command to run on your own machine.
        </p>
      </div>
    </div>
  )
}
