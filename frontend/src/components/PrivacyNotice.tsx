import { AUTHOR, type ServerConfig } from '../siteConfig'

interface Props {
  config: ServerConfig
}

/**
 * Every claim here is one the code actually keeps. See backend/server.js, where
 * the upload is deleted the moment FFmpeg exits and a sweeper clears anything
 * past the retention window regardless.
 */
export default function PrivacyNotice({ config }: Props) {
  const promises = [
    {
      title: 'Deleted straight after converting',
      body: `Your video goes the moment the conversion ends, whether it worked or not. The result is deleted as soon as you download it, and erased within ${config.retentionMinutes} minutes either way.`,
    },
    {
      title: 'No account, no cookies, no profiling',
      body: 'There is no sign up. The only analytics is an anonymous count of page visits, with no cookies and nothing that identifies you, and it never sees your video or its name. The page loads nothing from any other site, right down to using your own system fonts.',
    },
    {
      title: 'We never even learn the filename',
      body: 'The server knows your video as a random ID and nothing else. Your browser remembers the real name and puts it back on the download.',
    },
    {
      title: 'Nothing is written down',
      body: 'No logs, no record that a conversion happened and no addresses kept on disk. Nobody watches your video and no frame of it is saved.',
    },
  ]

  return (
    <section id="privacy">
      <div className="text-center mb-10">
        <span
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-semibold mb-4"
          style={{ background: 'var(--good-tint)', color: 'var(--good)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
          </svg>
          Private by default
        </span>
        <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
          Your video stays yours
        </h2>
        <p className="text-base mt-3 max-w-xl mx-auto" style={{ color: 'var(--text-2)' }}>
          This is a free tool, not a business. There is nothing to collect and
          nothing kept.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {promises.map(({ title, body }) => (
          <div key={title} className="card p-5 flex gap-3.5">
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 mt-0.5"
              style={{ background: 'var(--good-tint)', color: 'var(--good)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <div className="min-w-0">
              <p className="font-bold text-[15px] mb-1" style={{ color: 'var(--text)' }}>{title}</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{body}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm leading-relaxed mt-6 text-center" style={{ color: 'var(--text-3)' }}>
        You do not have to take any of that on trust.{' '}
        <a
          href={AUTHOR.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline underline-offset-2"
          style={{ color: 'var(--brand)' }}
        >
          The code is public
        </a>
        , so you can check that it does what this page says.
      </p>
    </section>
  )
}
