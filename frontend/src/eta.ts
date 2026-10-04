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
export function estimateRemaining(currentTime: number, duration: number, speed: string) {
  const rate = parseFloat(speed)
  if (!Number.isFinite(rate) || rate <= 0 || duration <= 0 || currentTime <= 0) return null
  const secondsLeft = (duration - currentTime) / rate
  if (!Number.isFinite(secondsLeft) || secondsLeft < 1) return null
  return formatDuration(secondsLeft)
}
