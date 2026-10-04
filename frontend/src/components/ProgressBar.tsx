import { estimateRemaining } from '../eta'

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
