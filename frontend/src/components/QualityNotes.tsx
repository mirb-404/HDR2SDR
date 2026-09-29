/**
 * Benefit tiles. Each gets its own colour so the grid reads at a glance rather
 * than as a wall of paragraphs, and the wording stays out of the technical
 * weeds. The reasoning behind each one lives in the README.
 */
export default function QualityNotes() {
  const points = [
    {
      title: 'Same size and sharpness',
      body: 'No shrinking, no cropping and no watermark. A 4K clip comes back as 4K.',
      color: '#f5541d',
      tint: '#fff1ec',
      icon: (
        <>
          <path d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      ),
    },
    {
      title: 'Bright areas keep detail',
      body: 'Skies, windows and sunsets stay as they were instead of turning into flat white patches.',
      color: '#0b7ddb',
      tint: '#e8f3fd',
      icon: (
        <>
          <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </>
      ),
    },
    {
      title: 'Smooth colour, no blotches',
      body: 'Gradients and dark scenes come out clean, without the banding you often get from a quick convert.',
      color: '#8b3ddb',
      tint: '#f3ecfd',
      icon: (
        <>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
          <path d="M12 3a9 9 0 010 18z" fill="currentColor" opacity="0.35"/>
        </>
      ),
    },
    {
      title: 'Sound comes along',
      body: 'Your audio is kept and stays in sync. Nothing is muted or trimmed.',
      color: '#12a150',
      tint: '#e9f8ef',
      icon: (
        <>
          <path d="M11 5L6 9H3v6h3l5 4V5z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
          <path d="M16 9a4 4 0 010 6M19 6a8 8 0 010 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </>
      ),
    },
    {
      title: 'Plays anywhere',
      body: 'Any browser, phone, TV or editor. No codec packs and no unsupported format warnings.',
      color: '#d64f8a',
      tint: '#fdecf4',
      icon: (
        <>
          <rect x="2" y="4" width="20" height="13" rx="2" stroke="currentColor" strokeWidth="2"/>
          <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </>
      ),
    },
    {
      title: 'Nothing is kept',
      body: 'Your video is deleted the moment it is converted. No account and no tracking.',
      color: '#0d9488',
      tint: '#e6f6f4',
      icon: (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
          <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      ),
    },
  ]

  return (
    <section>
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
          Everything else stays exactly as it was
        </h2>
        <p className="text-base mt-3 max-w-xl mx-auto" style={{ color: 'var(--text-2)' }}>
          Converting usually leaves video looking flat and grey. Only the brightness
          and colour change here.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {points.map(({ title, body, color, tint, icon }) => (
          <div key={title} className="tile">
            <span
              className="inline-flex items-center justify-center w-11 h-11 rounded-[10px] mb-4"
              style={{ background: tint, color }}
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none">{icon}</svg>
            </span>
            <p className="font-bold text-[15px] mb-1.5" style={{ color: 'var(--text)' }}>{title}</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
