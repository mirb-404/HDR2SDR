interface Props {
  percent: number
  fps: number
  speed: string
  currentTime: number
  duration: number
}

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.floor(secs % 60)
  return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`
}

export default function ProgressBar({ percent, fps, speed, currentTime, duration }: Props) {
  return (
    <div className="glass rounded-2xl p-4 sm:p-6 fade-in-up space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }}></div>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Converting…</span>
        </div>
        <span className="text-xl sm:text-2xl font-black mono" style={{ color: 'var(--accent-light)' }}>{percent}%</span>
      </div>

      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Speed', value: speed.endsWith('x') ? speed : speed + 'x', wide: false },
          { label: 'FPS', value: fps > 0 ? fps.toFixed(1) : '—', wide: false },
          { label: 'Time', value: duration > 0 ? `${formatTime(currentTime)} / ${formatTime(duration)}` : '—', wide: true },
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
    </div>
  )
}
