interface Props {
  percent: number
  fps: number
  speed: string
  currentTime: number
  duration: number
  queuePosition?: number
}

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`
}

// Rough time remaining from the encoder's own speed figure. Shown only once
// there is a real duration and a real speed, because a wrong estimate early on
// is worse than none.
function estimateRemaining(currentTime: number, duration: number, speed: string) {
  const rate = parseFloat(speed)
  if (!Number.isFinite(rate) || rate <= 0 || duration <= 0 || currentTime <= 0) return null
  const secondsLeft = (duration - currentTime) / rate
  if (!Number.isFinite(secondsLeft) || secondsLeft < 1) return null
  return formatTime(secondsLeft)
}

export default function ProgressBar({ percent, fps, speed, currentTime, duration, queuePosition = 0 }: Props) {
  if (queuePosition > 1) {
    return (
      <div className="glass rounded-2xl p-6 fade-in-up text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto pulse-glow"
          style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent-light)' }}>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
          You are number {queuePosition} in the queue
        </p>
        <p className="text-xs max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          This server converts one video at a time so that everyone's encode runs at full speed.
          Keep this tab open — it will start automatically.
        </p>
      </div>
    )
  }

  const remaining = estimateRemaining(currentTime, duration, speed)

  return (
    <div className="glass rounded-2xl p-4 sm:p-6 fade-in-up space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }}></div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Converting…</span>
        </div>
        <span className="text-xl sm:text-2xl font-black mono" style={{ color: 'var(--accent-light)' }}>{percent}%</span>
      </div>

      <div
        className="progress-bar-track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Conversion progress"
      >
        <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Speed', value: speed.endsWith('x') ? speed : speed + 'x', wide: false },
          { label: 'FPS', value: fps > 0 ? fps.toFixed(1) : '—', wide: false },
          {
            label: remaining ? 'Time left' : 'Time',
            value: remaining ?? (duration > 0 ? `${formatTime(currentTime)} / ${formatTime(duration)}` : '—'),
            wide: true,
          },
        ].map(({ label, value, wide }) => (
          <div
            key={label}
            className={`rounded-xl p-2.5 sm:p-3 text-center ${wide ? 'col-span-2 sm:col-span-1' : ''}`}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}
          >
            <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
            <p className="text-xs sm:text-sm font-bold mono break-words" style={{ color: 'var(--text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        Keep this tab open. Your upload is erased the moment this finishes.
      </p>
    </div>
  )
}
