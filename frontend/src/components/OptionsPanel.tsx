import { useState } from 'react'
import type { ServerConfig } from '../siteConfig'

export type Resolution = 'original' | '1080p'

interface Props {
  inputName: string
  config: ServerConfig
  resolution: Resolution
  onResolutionChange: (r: Resolution) => void
  disabled: boolean
}

const RESOLUTIONS: { value: Resolution; label: string; hint: string }[] = [
  { value: 'original', label: 'Original size', hint: 'A 4K clip stays 4K' },
  { value: '1080p', label: '1080p', hint: 'Up to 5x faster for 4K' },
]

// Must match the first zscale pass in server.js.
const FIRST_PASS: Record<Resolution, string> = {
  original: 'zscale=t=linear:npl=100:p=bt709',
  '1080p':
    "zscale=w='if(gt(iw,ih),-2,min(iw,1080))':h='if(gt(iw,ih),min(ih,1080),-2)':t=linear:npl=100:p=bt709",
}

const buildCommand = (name: string, config: ServerConfig, resolution: Resolution) => {
  const base = name || 'video.mp4'
  const out = base.replace(/\.[^.]+$/, '') + '_sdr.mp4'
  return [
    `ffmpeg -i "${base}" \\`,
    `  -vf "${FIRST_PASS[resolution]},\\`,
    `format=gbrpf32le,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p" \\`,
    `  -c:v libx264 -crf ${config.crf} -preset ${config.preset} \\`,
    `  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \\`,
    `  -c:a aac -b:a 192k -movflags +faststart \\`,
    `  "${out}"`,
  ].join('\n')
}

export default function OptionsPanel({ inputName, config, resolution, onResolutionChange, disabled }: Props) {
  const [showCommand, setShowCommand] = useState(false)
  const [copied, setCopied] = useState(false)

  const command = buildCommand(inputName, config, resolution)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked; the text is selectable anyway */
    }
  }

  return (
    <div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
        Your video will come back as a standard MP4 that plays anywhere. The frame
        rate and sound stay as they are, and so does the size unless you pick
        1080p. Only the brightness and colour are converted.
      </p>

      {/* Most HDR clips come off phones in 4K, and 4K is about five times the
          work of 1080p, so this is the one choice that changes the wait. */}
      <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Output size">
        {RESOLUTIONS.map((r) => {
          const selected = resolution === r.value
          return (
            <button
              key={r.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onResolutionChange(r.value)}
              className="text-left rounded-[10px] px-3.5 py-2.5 transition-colors disabled:cursor-not-allowed"
              style={{
                border: `1.5px solid ${selected ? 'var(--brand)' : 'var(--border-strong)'}`,
                background: selected ? 'var(--brand-tint)' : 'var(--surface)',
              }}
            >
              <span className="block text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {r.label}
              </span>
              <span className="block text-[12px] mt-0.5" style={{ color: selected ? 'var(--brand-press)' : 'var(--text-3)' }}>
                {r.hint}
              </span>
            </button>
          )
        })}
      </div>

      {/* The exact command, tucked away. Most people never need it, and the ones
          who do would rather run it themselves than upload anything. */}
      <div className="mt-4">
        <button
          onClick={() => setShowCommand(!showCommand)}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium transition-colors"
          style={{ color: 'var(--text-3)' }}
          aria-expanded={showCommand}
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            style={{ transform: showCommand ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
            aria-hidden="true"
          >
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Prefer to run it yourself?
        </button>

        <div className={`disclosure ${showCommand ? 'open' : ''}`}>
          <div>
            <div className="pt-3">
              <p className="text-[13px] mb-2" style={{ color: 'var(--text-3)' }}>
                This is the exact command the server runs. With FFmpeg installed you
                can use it on your own machine and upload nothing at all.
              </p>
              <div className="relative">
                <pre
                  className="mono text-[11.5px] leading-6 overflow-x-auto p-3 pr-16 rounded-lg whitespace-pre"
                  style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                >
                  {command}
                </pre>
                <button
                  onClick={copy}
                  className="absolute top-2 right-2 text-[12px] font-medium px-2.5 py-1 rounded-md transition-colors"
                  style={{ background: '#fff', border: '1px solid var(--border-strong)', color: 'var(--text-2)' }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
