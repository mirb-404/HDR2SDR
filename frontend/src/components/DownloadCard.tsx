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
      // one. The browser still has it, so the download gets named here.
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
      // Revoking immediately after click() can cancel the download in Safari,
      // so the object URL is released on the next turn of the event loop.
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000)
      setDownloading(false)
    }
  }

  return (
    <div className="glass rounded-2xl p-4 sm:p-6 fade-in-up" style={{ border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.05)' }}>
      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ color: '#10b981' }}>
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="flex-1 text-center sm:text-left">
          <p className="font-bold text-base" style={{ color: '#10b981' }}>Conversion complete</p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Your SDR video is ready — same resolution, BT.709 colour, audio intact.
          </p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="btn-primary w-full sm:w-auto flex-shrink-0"
          style={downloading ? {} : { background: 'linear-gradient(135deg, #059669, #047857)' }}
          id="download-btn"
        >
          {downloading ? (
            <>
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }}/>
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
              </svg>
              Downloading…
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="7 10 12 15 17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              Download SDR Video
            </>
          )}
        </button>
      </div>

      {/* The deadline matters — say it before they wander off, not after. */}
      <p className="mt-4 text-xs text-center sm:text-left leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {collected
          ? 'Downloaded — that file has now been deleted from the server. Nothing about this conversion was kept.'
          : `Download it now: the file is deleted the moment you do, and erased automatically within ${retentionMinutes} minutes either way.`}
      </p>

      {failed && (
        <p className="mt-3 text-xs px-3 py-2.5 rounded-lg" role="alert"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
          {failed}
        </p>
      )}
    </div>
  )
}
