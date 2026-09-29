import { useState } from 'react'
import type { ServerConfig } from '../siteConfig'

interface Props {
  inputName: string
  config: ServerConfig
}

const buildCommand = (name: string, config: ServerConfig) => {
  const base = name || 'video.mp4'
  const out = base.replace(/\.[^.]+$/, '') + '_sdr.mp4'
  return [
    `ffmpeg -i "${base}" \\`,
    `  -vf zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,\\`,
    `tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p \\`,
    `  -c:v libx264 -crf ${config.crf} -preset ${config.preset} \\`,
    `  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \\`,
    `  -c:a aac -b:a 192k -movflags +faststart \\`,
    `  "${out}"`,
  ].join('\n')
}

export default function OptionsPanel({ inputName, config }: Props) {
  const [showCommand, setShowCommand] = useState(false)
  const [copied, setCopied] = useState(false)

  const command = buildCommand(inputName, config)

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
        Your video will come back as a standard MP4 that plays anywhere. The size,
        sharpness, frame rate and sound all stay as they are. Only the brightness
        and colour are converted.
      </p>

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
