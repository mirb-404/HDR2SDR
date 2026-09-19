interface Props {
  inputName: string
}

const FIXED_COMMAND = (name: string) => {
  const base = name || 'video.mp4'
  const out = base.replace(/\.[^.]+$/, '') + '_sdr.mp4'
  return `ffmpeg -i ${base} \\\n  -vf zscale=t=linear:npl=100,format=gbrpf32le,\\\n       zscale=p=bt709,\\\n       tonemap=tonemap=hable:desat=0,\\\n       zscale=t=bt709:m=bt709:r=tv,\\\n       format=yuv420p \\\n  -c:v libx265 \\\n  -crf 22 \\\n  -preset medium \\\n  -tune fastdecode \\\n  ${out}`
}

const PIPELINE_STEPS = [
  { flag: 'zscale=t=linear:npl=100', label: 'Linear light, 100-nit peak', color: '#7c3aed' },
  { flag: 'format=gbrpf32le',        label: 'Float32 GBR (lossless math)', color: '#3b82f6' },
  { flag: 'zscale=p=bt709',          label: 'BT.2020 → BT.709 gamut',     color: '#06b6d4' },
  { flag: 'tonemap=hable:desat=0',   label: 'Hable filmic tone-map',       color: '#10b981' },
  { flag: 'zscale=t=bt709:m=bt709:r=tv', label: 'BT.709 gamma + TV range', color: '#f59e0b' },
  { flag: 'format=yuv420p',          label: 'YUV 4:2:0 SDR output',        color: '#ec4899' },
]

export default function OptionsPanel({ inputName }: Props) {
  return (
    <div className="space-y-5">
      {/* Pipeline steps */}
      <div>
        <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
          Fixed pipeline — 6-step HDR → SDR filter chain
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {PIPELINE_STEPS.map(({ flag, label, color }, i) => (
            <div key={i} className="flex items-center gap-2.5 sm:gap-3 px-3 py-2.5 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
              <div className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-black flex-shrink-0"
                style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>
                {i + 1}
              </div>
              <div className="min-w-0">
                <p className="mono text-[11px] sm:text-xs truncate" style={{ color: 'var(--accent-light)' }}>{flag}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Encoder params */}
      <div className="flex flex-wrap gap-2">
        {[
          { k: 'Codec', v: 'libx265 (HEVC)' },
          { k: 'CRF', v: '22' },
          { k: 'Preset', v: 'medium' },
          { k: 'Tune', v: 'fastdecode' },
        ].map(({ k, v }) => (
          <div key={k} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{k}:</span>
            <span className="font-semibold mono" style={{ color: 'var(--accent-light)' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Full command preview */}
      <div>
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Exact Command</p>
        {/* Horizontal scroll is the right call for a command — wrapping it would
            make it uncopyable. -webkit-overflow-scrolling keeps iOS momentum. */}
        <div className="rounded-xl p-3 sm:p-4 overflow-x-auto"
          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)', WebkitOverflowScrolling: 'touch' }}>
          <pre className="mono text-[11px] sm:text-xs leading-6 whitespace-pre" style={{ color: '#a78bfa' }}>
            {FIXED_COMMAND(inputName)}
          </pre>
        </div>
      </div>
    </div>
  )
}

export type { }
