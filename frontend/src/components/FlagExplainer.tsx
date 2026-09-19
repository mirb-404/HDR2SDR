import { useState } from 'react'

const FLAGS = [
  {
    flag: 'zscale=t=linear:npl=100',
    title: 'Linear Light Conversion',
    desc: 'Converts the video from its transfer characteristic (PQ/HLG for HDR) to linear light. The npl value is the peak luminance of your display in nits (default 100). All tone-mapping math happens in linear light.',
    color: '#7c3aed',
  },
  {
    flag: 'format=gbrpf32le',
    title: 'GBR Float32 Pixel Format',
    desc: 'Converts to 32-bit floating point GBR planar format. This high-precision format prevents banding and rounding errors during the heavy mathematical operations in the tone-mapping chain.',
    color: '#3b82f6',
  },
  {
    flag: 'zscale=p=bt709',
    title: 'BT.709 Color Primaries',
    desc: 'Converts the color primaries from BT.2020 (HDR) to BT.709 (standard SDR). This is a gamut mapping step — wide-gamut HDR colors are mapped into the standard SDR color space.',
    color: '#06b6d4',
  },
  {
    flag: 'tonemap=tonemap=hable:desat=0',
    title: 'Tone Mapping',
    desc: 'The actual tone-mapping step. Hable (Filmic) is a popular cinematic S-curve that preserves highlights and shadows better than simple clipping. desat controls how out-of-gamut colors are desaturated (0 = no desaturation).',
    color: '#10b981',
  },
  {
    flag: 'zscale=t=bt709:m=bt709:r=tv',
    title: 'BT.709 Transfer & Range',
    desc: 'Applies the BT.709 gamma transfer function and sets the output to TV/limited range (16-235). This is what your TV, monitor, and streaming services expect for normal SDR content.',
    color: '#f59e0b',
  },
  {
    flag: '-c:v libx265 / CRF',
    title: 'HEVC Encoding (libx265)',
    desc: 'Encodes output as HEVC/H.265 using CRF (Constant Rate Factor). Lower CRF = better quality & larger file. CRF 22 is a good balance. Preset controls encoding speed vs compression efficiency.',
    color: '#ef4444',
  },
]

export default function FlagExplainer() {
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
          What does each flag do?
        </h2>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          <span className="sm:hidden">Tap a row to expand an explanation</span>
          <span className="hidden sm:inline">Click to expand an explanation</span>
        </p>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
        {FLAGS.map((f, idx) => (
          <div key={idx}>
            <button
              className="w-full px-4 sm:px-6 py-4 flex items-center gap-3 text-left transition-colors"
              style={{ background: openIdx === idx ? 'rgba(255,255,255,0.03)' : 'transparent', minHeight: '56px' }}
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              aria-expanded={openIdx === idx}
              aria-controls={`flag-panel-${idx}`}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: f.color }}></div>
              {/* Two flex-1 columns left ~90px each on a phone, so they stack
                  vertically until there is room for a single row */}
              <span className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-3">
                <code className="text-[11px] sm:text-xs mono truncate sm:flex-1" style={{ color: 'var(--accent-light)' }}>{f.flag}</code>
                <span className="text-sm font-medium sm:flex-1" style={{ color: 'var(--text-secondary)' }}>{f.title}</span>
              </span>
              <svg
                width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0"
                style={{ color: 'var(--text-muted)', transform: openIdx === idx ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s' }}
              >
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div id={`flag-panel-${idx}`} className={`accordion-content ${openIdx === idx ? 'open' : ''}`}>
              <div>
                <div className="px-4 sm:px-6 pb-5">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', borderLeft: `3px solid ${f.color}`, paddingLeft: '12px' }}>
                    {f.desc}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
