import { useState, useEffect, useRef } from 'react'
import UploadZone from './UploadZone'
import OptionsPanel from './OptionsPanel'
import ProgressBar from './ProgressBar'
import DownloadCard from './DownloadCard'
import FlagExplainer from './FlagExplainer'
import QualityNotes from './QualityNotes'
import PrivacyNotice from './PrivacyNotice'
import { useServerConfig } from '../useServerConfig'

type Stage = 'upload' | 'options' | 'converting' | 'done' | 'error'

interface ProgressState {
  percent: number
  fps: number
  speed: string
  currentTime: number
  duration: number
}

const IDLE_PROGRESS: ProgressState = { percent: 0, fps: 0, speed: '?', currentTime: 0, duration: 0 }

/**
 * Uploads via XHR rather than fetch purely because fetch still cannot report
 * upload progress. On a phone sending a few hundred megabytes, a bar that moves
 * is the difference between waiting and assuming the page has frozen.
 */
function uploadWithProgress(
  file: File,
  onProgress: (percent: number) => void,
  register: (xhr: XMLHttpRequest) => void
): Promise<{ jobId: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    register(xhr)
    xhr.open('POST', '/api/upload')

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      let body: { jobId?: string; error?: string } | null = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        /* a proxy returned an HTML error page rather than our JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.jobId) return resolve({ jobId: body.jobId })
      if (xhr.status === 413) {
        return reject(new Error(body?.error ?? 'That file is over the size limit.'))
      }
      if (xhr.status === 429) {
        return reject(new Error(body?.error ?? 'Too many uploads. Please wait a few minutes.'))
      }
      reject(new Error(body?.error ?? `Upload failed (HTTP ${xhr.status}).`))
    }

    xhr.onerror = () => reject(new Error('The upload was interrupted. Check your connection and try again.'))
    xhr.onabort = () => reject(new Error('Upload cancelled.'))

    const formData = new FormData()
    formData.append('video', file)
    xhr.send(formData)
  })
}

export default function ConverterApp() {
  const config = useServerConfig()

  const [stage, setStage] = useState<Stage>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string>('')
  const [progress, setProgress] = useState<ProgressState>(IDLE_PROGRESS)
  const [queuePosition, setQueuePosition] = useState(0)
  const [error, setError] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [uploadPercent, setUploadPercent] = useState(0)

  const eventSourceRef = useRef<EventSource | null>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
      xhrRef.current?.abort()
    }
  }, [])

  const handleFileSelected = (f: File) => {
    setFile(f)
    setError('')
    setStage('options')
  }

  const handleConvert = async () => {
    if (!file) return

    setUploading(true)
    setUploadPercent(0)
    setError('')

    try {
      const { jobId: id } = await uploadWithProgress(
        file,
        setUploadPercent,
        (xhr) => { xhrRef.current = xhr }
      )

      setJobId(id)
      setUploading(false)
      setStage('converting')
      setProgress(IDLE_PROGRESS)
      setQueuePosition(0)

      // Subscribe before asking for the conversion, so no early progress event
      // is missed. The server also replays the last event on connect, which
      // covers a phone that slept and reconnected mid-encode.
      const es = new EventSource(`/api/progress/${id}`)
      eventSourceRef.current = es

      es.onmessage = (evt) => {
        const data = JSON.parse(evt.data)

        if (data.error) {
          setError(data.error)
          setStage('error')
          es.close()
          return
        }
        if (data.queued) {
          setQueuePosition(data.position ?? 0)
          return
        }

        setQueuePosition(0)
        setProgress({
          percent: data.percent ?? 0,
          fps: data.fps ?? 0,
          speed: data.speed ?? '?',
          currentTime: data.currentTime ?? 0,
          duration: data.duration ?? 0,
        })
        if (data.done) {
          setStage('done')
          es.close()
        }
      }

      // The server ends the stream itself once a job finishes, so a close here
      // is normal and must not be reported as a failure.
      es.onerror = () => { /* stream closed — terminal state already handled above */ }

      const convertRes = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id }),
      })
      if (!convertRes.ok) {
        const body = await convertRes.json().catch(() => null)
        throw new Error(body?.error ?? 'Could not start the conversion.')
      }
      const { position } = await convertRes.json()
      if (position > 1) setQueuePosition(position)
    } catch (e) {
      eventSourceRef.current?.close()
      setError((e as Error).message)
      setStage('error')
      setUploading(false)
    }
  }

  const reset = () => {
    eventSourceRef.current?.close()
    xhrRef.current?.abort()
    xhrRef.current = null
    setStage('upload')
    setFile(null)
    setJobId('')
    setProgress(IDLE_PROGRESS)
    setQueuePosition(0)
    setError('')
    setUploading(false)
    setUploadPercent(0)
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6 sm:space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3 mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-2"
          style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: 'var(--accent-light)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          HDR → BT.709 SDR · Hable tone mapping
        </div>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Convert{' '}
          <span style={{ background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            HDR to SDR
          </span>
        </h1>
        <p className="text-sm sm:text-base max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Fix washed-out, grey HDR footage that will not play properly. Free, no sign-up,
          and your file is deleted the moment it is converted.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-1.5 sm:gap-3 mb-4">
        {(['upload', 'options', 'converting', 'done'] as Stage[]).map((s, i) => {
          const labels = ['Upload', 'Review', 'Converting', 'Done']
          const isActive = stage === s
          const isDone = ['upload', 'options', 'converting', 'done'].indexOf(stage) > i
          return (
            <div key={s} className="flex items-center gap-1.5 sm:gap-2">
              {i > 0 && <div className="w-4 sm:w-8 h-px" style={{ background: isDone || isActive ? 'var(--accent)' : 'var(--border)' }} />}
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                  style={{
                    background: isActive ? 'var(--accent)' : isDone ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.07)',
                    color: isActive || isDone ? 'var(--accent-light)' : 'var(--text-muted)',
                    border: isActive ? '2px solid var(--accent-light)' : isDone ? '2px solid rgba(124,58,237,0.5)' : '2px solid var(--border)',
                  }}
                >
                  {isDone ? '✓' : i + 1}
                </div>
                <span className="text-xs hidden sm:inline" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                  {labels[i]}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Main card */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-6 md:p-8 space-y-6">

          {/* Upload step */}
          {(stage === 'upload' || stage === 'options') && (
            <UploadZone onFileSelected={handleFileSelected} config={config} />
          )}

          {/* Options step */}
          {stage === 'options' && file && (
            <div className="fade-in-up space-y-6">
              <div className="border-t pt-6" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between gap-3 mb-5">
                  <h2 className="text-sm sm:text-base font-bold" style={{ color: 'var(--text-primary)' }}>What will happen to your file</h2>
                  <button onClick={reset} disabled={uploading} className="btn-secondary text-xs py-1.5 px-3 flex-shrink-0">← Start over</button>
                </div>
                <OptionsPanel inputName={file.name} config={config} />
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: 'var(--text-secondary)' }}>Uploading…</span>
                    <span className="mono font-bold" style={{ color: 'var(--accent-light)' }}>{uploadPercent}%</span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${uploadPercent}%` }} />
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Your file is deleted as soon as the conversion finishes.
                  </p>
                </div>
              )}

              <button
                onClick={handleConvert}
                disabled={uploading}
                className="btn-primary w-full py-3.5 text-base"
                id="convert-btn"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }}/>
                      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
                    </svg>
                    Uploading… {uploadPercent}%
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Start Conversion
                  </>
                )}
              </button>
            </div>
          )}

          {/* Converting */}
          {stage === 'converting' && (
            <ProgressBar {...progress} queuePosition={queuePosition} />
          )}

          {/* Done */}
          {stage === 'done' && (
            <div className="space-y-4 fade-in-up">
              <DownloadCard
                jobId={jobId}
                originalName={file?.name ?? 'video.mp4'}
                retentionMinutes={config.retentionMinutes}
              />
              <button onClick={reset} className="btn-secondary w-full" id="convert-another-btn">
                Convert another video
              </button>
            </div>
          )}

          {/* Error */}
          {stage === 'error' && (
            <div className="fade-in-up">
              <div className="rounded-2xl p-4 sm:p-6" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.2)' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#ef4444' }}>
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ color: '#ef4444' }}>Conversion Failed</p>
                    <p className="text-sm mt-1 break-words" style={{ color: 'var(--text-secondary)' }}>{error}</p>
                    <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                      Whatever went wrong, your file has already been deleted from the server.
                    </p>
                  </div>
                </div>
              </div>
              <button onClick={reset} className="btn-secondary mt-4 w-full">Try again</button>
            </div>
          )}
        </div>
      </div>

      <QualityNotes config={config} />
      <FlagExplainer />
      <PrivacyNotice config={config} />
    </div>
  )
}
