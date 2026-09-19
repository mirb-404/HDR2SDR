import { useRef, useState } from 'react'

interface Props {
  onFileSelected: (file: File) => void
}

export default function UploadZone({ onFileSelected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selected, setSelected] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rejected, setRejected] = useState<string>('')

  const handleFile = (file: File) => {
    if (!file.type.startsWith('video/')) {
      // Inline message rather than alert() — a modal dialog is especially
      // disruptive on a phone, and it hides the zone you need to tap next.
      setRejected(`"${file.name}" is not a video file.`)
      return
    }
    setRejected('')
    setSelected(file)
    setPreviewUrl(URL.createObjectURL(file))
    onFileSelected(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelected(null)
    setPreviewUrl(null)
  }

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
    if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024).toFixed(0)} KB`
  }

  if (selected && previewUrl) {
    return (
      <div className="glass rounded-2xl p-4 sm:p-5 fade-in-up">
        <div className="flex items-start gap-3 sm:gap-4">
          <video
            src={previewUrl}
            className="w-20 h-14 sm:w-32 sm:h-20 object-cover rounded-xl flex-shrink-0"
            style={{ border: '1px solid var(--border)' }}
            preload="metadata"
            playsInline
            muted
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate text-sm" style={{ color: 'var(--text-primary)' }}>{selected.name}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{formatSize(selected.size)}</p>
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{selected.type}</p>
          </div>
          {/* Wide enough to tap on desktop; the full-width button below takes
              over on phones where this corner is hard to reach */}
          <button
            onClick={clearSelection}
            className="hidden sm:inline-flex text-xs px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            Remove
          </button>
        </div>
        <button
          onClick={clearSelection}
          className="sm:hidden w-full mt-3 text-xs rounded-lg transition-colors"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', minHeight: '44px' }}
        >
          Remove
        </button>
      </div>
    )
  }

  return (
    <div>
      <div
        className={`drop-zone rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all ${dragging ? 'dragging' : ''}`}
        style={{ background: dragging ? 'rgba(124,58,237,0.07)' : 'rgba(255,255,255,0.02)' }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 pulse-glow"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(59,130,246,0.2))', border: '1px solid rgba(124,58,237,0.4)' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--accent-light)' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        {/* Phones have no drag-and-drop, so they get tap wording instead */}
        <p className="font-semibold text-sm sm:text-base mb-1" style={{ color: 'var(--text-primary)' }}>
          <span className="sm:hidden">Tap to choose a video</span>
          <span className="hidden sm:inline">Drop your HDR video here</span>
        </p>
        <p className="text-xs sm:text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
          <span className="sm:hidden">MP4, MKV, MOV, etc.</span>
          <span className="hidden sm:inline">or click to browse — MP4, MKV, MOV, etc.</span>
        </p>
        <div className="inline-flex items-center gap-2 text-xs px-3 sm:px-4 py-2 rounded-full" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: 'var(--accent-light)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0"><path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-11v6h2v-6h-2zm0-4v2h2V7h-2z"/></svg>
          Up to 10 GB supported
        </div>
      </div>

      {rejected && (
        <p className="mt-3 text-xs px-3 py-2.5 rounded-lg fade-in-up" role="alert"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
          {rejected}
        </p>
      )}
    </div>
  )
}
