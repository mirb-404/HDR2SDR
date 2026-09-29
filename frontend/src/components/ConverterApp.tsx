import { useState, useEffect, useRef } from 'react'
import UploadZone from './UploadZone'
import OptionsPanel from './OptionsPanel'
import ProgressBar from './ProgressBar'
import DownloadCard from './DownloadCard'
import QualityNotes from './QualityNotes'
import PrivacyNotice from './PrivacyNotice'
import BeforeAfter from './BeforeAfter'
import HowItWorks from './HowItWorks'
import { formatBytes } from '../siteConfig'
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
      if (xhr.status === 413) return reject(new Error(body?.error ?? 'That file is over the size limit.'))
      if (xhr.status === 429) return reject(new Error(body?.error ?? 'Too many uploads. Please wait a few minutes.'))
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
      const { jobId: id } = await uploadWithProgress(file, setUploadPercent, (xhr) => {
        xhrRef.current = xhr
      })

      setJobId(id)
      setUploading(false)
      setStage('converting')
      setProgress(IDLE_PROGRESS)
      setQueuePosition(0)

      // Subscribe before asking for the conversion so no early progress event
      // is missed. The server also replays the last event on connect, which
      // covers a phone that slept and reconnected mid encode.
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
      es.onerror = () => { /* terminal states are already handled above */ }

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

  const idle = stage === 'upload'

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────────
          On a single purpose tool the action belongs above everything else, so
          the upload button sits in the headline block rather than in a panel
          further down the page. */}
      <section className="px-5 sm:px-6 pt-14 sm:pt-20 pb-14">
        <div className="max-w-3xl mx-auto text-center">
          <h1
            className="text-[34px] sm:text-5xl font-extrabold leading-[1.1] tracking-[-0.03em]"
            style={{ color: 'var(--text)' }}
          >
            Fix HDR video that looks
            <br className="hidden sm:block" />{' '}
            <span style={{ color: 'var(--brand)' }}>washed out and grey</span>
          </h1>
          <p
            className="text-base sm:text-lg mt-5 max-w-xl mx-auto leading-relaxed"
            style={{ color: 'var(--text-2)' }}
          >
            HDR footage looks wrong on screens and apps that cannot handle it.
            Convert it in a couple of clicks and keep every bit of the quality.
          </p>

          <div className="mt-9">
            {idle && <UploadZone onFileSelected={handleFileSelected} config={config} />}
          </div>
        </div>

        {/* Working panel, shown once a file is in hand. */}
        {!idle && (
          <div className="max-w-xl mx-auto card p-5 sm:p-7 rise">
            {stage === 'options' && file && (
              <div>
                <div className="flex items-center gap-3.5 pb-5 mb-5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span
                    className="inline-flex items-center justify-center w-11 h-11 rounded-[10px] flex-shrink-0"
                    style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M15 10l4.5-2.5v9L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <rect x="3" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  </span>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
                      {file.name}
                    </p>
                    <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <button
                    onClick={reset}
                    disabled={uploading}
                    className="text-[13px] font-medium px-3 py-2 rounded-lg flex-shrink-0 transition-colors"
                    style={{ color: 'var(--text-3)' }}
                  >
                    Remove
                  </button>
                </div>

                <OptionsPanel inputName={file.name} config={config} />

                {uploading && (
                  <div className="mt-6">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Uploading</span>
                      <span className="text-sm font-bold mono" style={{ color: 'var(--brand)' }}>{uploadPercent}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${uploadPercent}%` }} />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleConvert}
                  disabled={uploading}
                  className="btn btn-primary w-full mt-6 text-base"
                  style={{ minHeight: '54px' }}
                  id="convert-btn"
                >
                  {uploading ? `Uploading ${uploadPercent}%` : 'Convert to SDR'}
                </button>
              </div>
            )}

            {stage === 'converting' && <ProgressBar {...progress} queuePosition={queuePosition} />}

            {stage === 'done' && (
              <div>
                <DownloadCard
                  jobId={jobId}
                  originalName={file?.name ?? 'video.mp4'}
                  retentionMinutes={config.retentionMinutes}
                />
                <button onClick={reset} className="btn btn-secondary w-full mt-5" id="convert-another-btn">
                  Convert another video
                </button>
              </div>
            )}

            {stage === 'error' && (
              <div className="text-center py-3">
                <span
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-4"
                  style={{ background: 'var(--bad-tint)', color: 'var(--bad)' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 8v5M12 16.5v.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                </span>
                <p className="text-lg font-bold" style={{ color: 'var(--text)' }}>That did not work</p>
                <p className="text-sm mt-2 leading-relaxed break-words" style={{ color: 'var(--text-2)' }}>
                  {error}
                </p>
                <p className="text-[13px] mt-3" style={{ color: 'var(--text-3)' }}>
                  Whatever went wrong, your video has already been deleted from the server.
                </p>
                <button onClick={reset} className="btn btn-secondary w-full mt-6">
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Proof ────────────────────────────────────────────────────────── */}
      <section style={{ background: 'var(--bg-alt)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div className="max-w-3xl mx-auto px-5 sm:px-6 py-14 sm:py-16">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
              See the difference
            </h2>
            <p className="text-base mt-3 max-w-xl mx-auto" style={{ color: 'var(--text-2)' }}>
              This is what HDR looks like on a screen that cannot show it, and what
              it looks like afterwards.
            </p>
          </div>
          <BeforeAfter />
        </div>
      </section>

      {/* ── Everything else ──────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-5 sm:px-6 py-16 sm:py-20 space-y-20 sm:space-y-24">
        <QualityNotes />
        <HowItWorks
          maxUploadLabel={config.maxUploadLabel}
          retentionMinutes={config.retentionMinutes}
        />
        <PrivacyNotice config={config} />
      </div>
    </>
  )
}
