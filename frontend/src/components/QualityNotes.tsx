import type { ServerConfig } from '../siteConfig'

interface Props {
  config: ServerConfig
}

/**
 * The "what you keep" section. People are rightly suspicious that a free
 * converter will hand back a washed-out, re-compressed mess, so this spells out
 * what the pipeline actually preserves and why.
 */
export default function QualityNotes({ config }: Props) {
  const points = [
    {
      title: 'Full resolution, untouched',
      body: 'No downscaling, no cropping, no watermark. A 4K clip comes back 4K, frame for frame, at the original frame rate.',
      icon: (
        <>
          <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </>
      ),
      color: '#7c3aed',
    },
    {
      title: 'Tone-mapped, not clipped',
      body: 'The lazy way to kill HDR is to clamp everything brighter than white, which blows out skies and skin. The Hable filmic curve rolls highlights off gradually instead, so clouds, sunsets and bright windows keep their detail.',
      icon: (
        <>
          <path d="M3 17c3-8 6-10 9-10s6 2 9 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
          <circle cx="12" cy="7" r="1.5" fill="currentColor"/>
        </>
      ),
      color: '#10b981',
    },
    {
      title: 'Maths done in 32-bit float',
      body: 'The whole chain runs in linear light at floating-point precision before it is written back to 8-bit. That is what stops the banding you normally see across gradients and dark scenes.',
      icon: (
        <>
          <path d="M4 12h16M12 4v16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none"/>
        </>
      ),
      color: '#3b82f6',
    },
    {
      title: 'Colours land where they should',
      body: 'Output is tagged BT.709 for primaries, transfer and matrix. Players do not have to guess what they are being handed, which is the usual reason a "converted" file still looks grey or oversaturated.',
      icon: (
        <>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none"/>
          <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" opacity="0.5"/>
        </>
      ),
      color: '#f59e0b',
    },
    {
      title: `Near-transparent re-encode (CRF ${config.crf})`,
      body: `HDR has to be re-encoded — there is no way around that — so it is done at CRF ${config.crf}, well above the point where differences become visible. Audio is kept and re-muxed at ${config.audio}.`,
      icon: (
        <>
          <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2" fill="none"/>
          <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2" fill="none"/>
        </>
      ),
      color: '#ec4899',
    },
    {
      title: 'Plays on literally everything',
      body: 'H.264 in an MP4 with faststart. It opens in every browser, phone, smart TV and editor — no codec packs, no "unsupported format", and it starts playing before it finishes downloading.',
      icon: (
        <>
          <rect x="2" y="4" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
          <path d="M8 21h8M12 18v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </>
      ),
      color: '#06b6d4',
    },
  ]

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
          HDR comes off. The quality stays on.
        </h2>
        <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          Converting to SDR normally means a flat, washed-out video. Here is what this
          pipeline does differently.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0" style={{ borderColor: 'var(--border)' }}>
        {points.map(({ title, body, icon, color }) => (
          <div key={title} className="px-4 sm:px-6 py-4 flex gap-3" style={{ borderColor: 'var(--border)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: `${color}1f`, border: `1px solid ${color}44`, color }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">{icon}</svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
