import { useRef, useState, useCallback } from 'react'

/**
 * Drag to wipe between the two frames.
 *
 * Both images are real output: a test scene was encoded as HDR10 (PQ, BT.2020),
 * then "before" is that file decoded straight to an ordinary screen with no
 * conversion, which is what people actually see, and "after" is the same file
 * put through this site's pipeline. Nothing is staged or retouched.
 *
 * The overlay is clipped with clip-path rather than a width-constrained
 * wrapper, so the top image never squashes as the divider moves.
 */
export default function BeforeAfter() {
  const [position, setPosition] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const setFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.min(100, Math.max(0, pct)))
  }, [])

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    setFromClientX(e.clientX)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    setFromClientX(e.clientX)
  }

  const endDrag = (e: React.PointerEvent) => {
    dragging.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  // Keyboard support, because a drag-only control is unusable without a mouse.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setPosition((p) => Math.max(0, p - 4))
    if (e.key === 'ArrowRight') setPosition((p) => Math.min(100, p + 4))
    if (e.key === 'Home') setPosition(0)
    if (e.key === 'End') setPosition(100)
  }

  return (
    <div>
      <div
        ref={containerRef}
        className="ba"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        role="slider"
        tabIndex={0}
        aria-label="Drag to compare the video before and after converting"
        aria-valuenow={Math.round(position)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* The converted frame sits underneath and sets the height. */}
        <img
          src="/demo-after.jpg"
          alt="The same frame after converting, with colour and contrast restored"
          className="block w-full"
          draggable={false}
          width={720}
          height={405}
        />

        {/* The untouched frame is laid over it and clipped to the divider. */}
        <img
          src="/demo-before.jpg"
          alt="An HDR frame shown on an ordinary screen, looking grey and washed out"
          className="absolute inset-0 w-full h-full"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          draggable={false}
          width={720}
          height={405}
        />

        <span
          className="ba-tag left-3"
          style={{ background: 'rgba(22,25,31,0.72)', color: '#fff' }}
        >
          HDR on a normal screen
        </span>
        <span
          className="ba-tag right-3"
          style={{ background: 'var(--brand)', color: '#fff' }}
        >
          After HDR2SDR
        </span>

        <div className="ba-handle" style={{ left: `calc(${position}% - 1.5px)` }}>
          <span className="ba-knob">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </span>
        </div>
      </div>

      <p className="text-sm mt-3 text-center" style={{ color: 'var(--text-3)' }}>
        Drag the slider. Both frames come from the same HDR file, one shown as your
        screen would show it and one after converting.
      </p>
    </div>
  )
}
