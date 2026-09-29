interface Props {
  percent: number
  fps: number
  speed: string
  currentTime: number
  duration: number
  queuePosition?: number
}

function formatDuration(secs: number) {
  if (secs < 60) return 'less than a minute'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `about ${mins} minute${mins === 1 ? '' : 's'}`
  const hours = Math.floor(mins / 60)
  return `about ${hours}h ${mins % 60}m`
}

// Time remaining from the encoder's own speed figure. Shown only once there is
// a real duration and a real speed, because a wrong estimate early on is worse
// than none at all.
function estimateRemaining(currentTime: number, duration: number, speed: string) {
  const rate = parseFloat(speed)
  if (!Number.isFinite(rate) || rate <= 0 || duration <= 0 || currentTime <= 0) return null
  const secondsLeft = (duration - currentTime) / rate
  if (!Number.isFinite(secondsLeft) || secondsLeft < 1) return null
  return formatDuration(secondsLeft)
}

export default function ProgressBar({ percent, speed, currentTime, duration, queuePosition = 0 }: Props) {
  if (queuePosition > 1) {
    return (
      <div className="py-10 text-center rise">
        <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>
          You are number {queuePosition} in the queue
        </p>
        <p className="text-sm mt-2 max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--text-2)' }}>
          This server converts one video at a time so each one runs at full speed.
          Keep this tab open and yours will start on its own.
        </p>
      </div>
    )
  }

  const remaining = estimateRemaining(currentTime, duration, speed)

  return (
    <div className="py-6 rise">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-base font-bold" style={{ color: 'var(--text)' }}>Converting your video</span>
        <span className="text-xl font-extrabold mono" style={{ color: 'var(--brand)' }}>{percent}%</span>
      </div>

      <div
        className="progress-track"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Conversion progress"
      >
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>

      <p className="text-sm mt-4" style={{ color: 'var(--text-2)' }}>
        {remaining ? `${remaining} left. ` : ''}Keep this tab open. Your video is
        erased the moment this finishes.
      </p>
    </div>
  )
}
