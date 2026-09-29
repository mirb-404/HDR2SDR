import { useState } from 'react'

interface Props {
  jobId: string
  originalName: string
  retentionMinutes: number
}

export default function DownloadCard({ jobId, originalName, retentionMinutes }: Props) {
  const [downloading, setDownloading] = useState(false)
  const [failed, setFailed] = useState('')
  const [collected, setCollected] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    setFailed('')
    let url: string | null = null
    try {
      const res = await fetch(`/api/download/${jobId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error ?? `Download failed (HTTP ${res.status}).`)
      }
      const blob = await res.blob()
      url = URL.createObjectURL(blob)

      // The server sends a generic filename because it was never told the real
      // one, so the download gets named here instead.
      const a = document.createElement('a')
      a.href = url
      a.download = `${originalName.replace(/\.[^.]+$/, '')}_sdr.mp4`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setCollected(true)
    } catch (e) {
      setFailed((e as Error).message)
    } finally {
      // Revoking straight after click() can cancel the download in Safari, so
      // the object URL is released on a later turn of the event loop.
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000)
      setDownloading(false)
    }
  }

  return (
    <div className="text-center py-4 rise">
      <span
        className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-5"
        style={{ background: 'var(--good-tint)', color: 'var(--good)' }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </span>

      <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
        Your video is ready
      </h2>
      <p className="text-sm mt-2 mb-6" style={{ color: 'var(--text-2)' }}>
        Same size and sharpness, sound kept, and it plays anywhere.
      </p>

      <button
        onClick={handleDownload}
        disabled={downloading}
        className="btn btn-primary btn-hero"
        id="download-btn"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 4v12M12 16l-4.5-4.5M12 16l4.5-4.5" stroke="currentColor" strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
        </svg>
        {downloading ? 'Downloading' : 'Download video'}
      </button>

      {/* The deadline matters, so it is said before they wander off. */}
      <p className="mt-5 text-[13px] leading-relaxed max-w-md mx-auto" style={{ color: 'var(--text-3)' }}>
        {collected
          ? 'Done. That file has been deleted from the server and nothing about this conversion was kept.'
          : `Grab it now. The file is deleted the moment you download it, and erased within ${retentionMinutes} minutes either way.`}
      </p>

      {failed && (
        <p className="mt-4 text-sm px-4 py-3 rounded-lg inline-block" role="alert"
          style={{ background: 'var(--bad-tint)', border: '1px solid #fecdca', color: 'var(--bad)' }}>
          {failed}
        </p>
      )}
    </div>
  )
}
