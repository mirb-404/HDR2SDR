import { useRef, useState, useEffect } from 'react'
import { MAX_FILES, type ServerConfig } from '../siteConfig'

interface Props {
  onFilesSelected: (files: File[]) => void
  config: ServerConfig
}

export default function UploadZone({ onFilesSelected, config }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pageDragging, setPageDragging] = useState(false)
  const dragDepth = useRef(0)

  // The whole window is the drop target, so there is no small rectangle to aim
  // at. dragenter and dragleave fire for every child element, so a depth
  // counter is what keeps the overlay from flickering as the pointer moves.
  useEffect(() => {
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      dragDepth.current += 1
      setPageDragging(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    const onDragLeave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1)
      if (dragDepth.current === 0) setPageDragging(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      dragDepth.current = 0
      setPageDragging(false)
      const files = Array.from(e.dataTransfer.files ?? [])
      if (files.length) onFilesSelected(files)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  })

  return (
    <div className="text-center">
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          // Cleared so picking the same file again still fires a change.
          e.target.value = ''
          if (files.length) onFilesSelected(files)
        }}
      />

      <button onClick={() => inputRef.current?.click()} className="btn btn-primary btn-hero">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 16V4M12 4L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round"/>
        </svg>
        Select videos
      </button>

      <p className="text-sm mt-4 hidden sm:block" style={{ color: 'var(--text-3)' }}>
        Up to {MAX_FILES} at once, or drop them anywhere on this page
      </p>
      <p className="text-sm mt-4 sm:hidden" style={{ color: 'var(--text-3)' }}>
        MP4, MKV, MOV and more
      </p>

      {/* The three things somebody wants to know before handing over a file. */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mt-7 text-[13px]">
        {[
          { label: `Up to ${config.maxUploadLabel}`, brand: false },
          { label: 'Deleted after converting', brand: true },
          { label: 'Free, no sign up', brand: false },
        ].map(({ label, brand }) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium"
            style={
              brand
                ? { background: 'var(--good-tint)', color: 'var(--good)' }
                : { background: 'var(--bg-alt)', color: 'var(--text-2)' }
            }
          >
            {brand && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3"
                  strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {label}
          </span>
        ))}
      </div>

      {pageDragging && (
        <div className="page-drop">
          <div className="page-drop-inner">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" className="mx-auto mb-3"
              style={{ color: 'var(--brand)' }} aria-hidden="true">
              <path d="M12 16V4M12 4L7.5 8.5M12 4l4.5 4.5" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round"/>
            </svg>
            <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>Drop them anywhere</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>
              Release to start converting
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
