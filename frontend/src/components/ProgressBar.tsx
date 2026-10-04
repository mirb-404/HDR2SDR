interface Props {
  percent: number
  fps: number
  speed: string
  currentTime: number
  duration: number
  phase?: Phase
}

export type Phase = 'waiting' | 'fetching' | 'encoding' | 'saving'

const TITLES: Record<Phase, string> = {
  waiting: 'Waiting for a free encoder',
  fetching: 'Getting your video ready',
  encoding: 'Converting your video',
  saving: 'Saving the result',
}

function formatDuration(secs: number) {
  // Seconds are rounded up to the next 10 so the figure does not flicker on
  // every progress line, and never reads 0 while work is left.
  if (secs < 60) return `About ${Math.max(10, Math.ceil(secs / 10) * 10)} seconds left`
  if (secs < 120) return 'About 1 minute left'
  const mins = Math.round(secs / 60)
  if (mins < 60) return `About ${mins} minutes left`
  const hours = Math.floor(mins / 60)
  return `About ${hours}h ${mins % 60}m left`
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

export default function ProgressBar({ percent, speed, currentTime, duration, phase = 'encoding' }: Props) {
  if (phase === 'waiting') {
    return (
      <div className="py-10 text-center rise">
        <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>
          {TITLES.waiting}
        </p>
        <p className="text-sm mt-2 max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--text-2)' }}>
          Each encoder converts one video at a time so it runs at full speed.
          Keep this tab open and yours will start on its own.
        </p>
      </div>
    )
  }

  const remaining = phase === 'encoding' ? estimateRemaining(currentTime, duration, speed) : null
  const status =
    phase === 'encoding' ? remaining ?? 'Estimating time left' :
    phase === 'saving' ? 'Almost done' :
    'Starting up'

  return (
    <div className="py-6 rise">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-base font-bold" style={{ color: 'var(--text)' }}>{TITLES[phase]}</span>
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

      <div className="flex items-baseline justify-between gap-3 mt-3">
        <span className="text-[15px] font-semibold" style={{ color: 'var(--text)' }} aria-live="polite">
          {status}
        </span>
        {phase === 'encoding' && parseFloat(speed) > 0 && (
          <span className="text-[13px] mono" style={{ color: 'var(--text-3)' }}>
            {parseFloat(speed).toFixed(2)}x speed
          </span>
        )}
      </div>

      <p className="text-sm mt-4" style={{ color: 'var(--text-2)' }}>
        Keep this tab open. Your video is erased the moment this finishes.
      </p>
    </div>
  )
}
