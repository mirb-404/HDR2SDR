import { useState, useEffect, useRef } from 'react'
import { uploadPresigned } from '@vercel/blob/client'
import UploadZone from './UploadZone'
import OptionsPanel, { type Resolution } from './OptionsPanel'
import ProgressBar, { type Phase } from './ProgressBar'
import DownloadCard from './DownloadCard'
import BatchList from './BatchList'
import QualityNotes from './QualityNotes'
import PrivacyNotice from './PrivacyNotice'
import BeforeAfter from './BeforeAfter'
import HowItWorks from './HowItWorks'
import { formatBytes, MAX_FILES, checkVideo } from '../siteConfig'
import { probeHdr } from '../hdrProbe'
import { useServerConfig } from '../useServerConfig'

type Stage = 'upload' | 'options' | 'working'

interface ProgressState {
  percent: number
  fps: number
  speed: string
  currentTime: number
  duration: number
}

interface ConvertEvent extends Partial<ProgressState> {
  stage?: 'fetching' | 'saving'
  waiting?: boolean
  done?: boolean
  error?: string
  pathname?: string
  downloadUrl?: string
}

export interface ConvertedFile {
  pathname: string
  downloadUrl: string
}

// ready: picked, not started. queued: uploaded, waiting for the one before it
// to finish converting.
type ItemStatus = 'ready' | 'uploading' | 'queued' | 'converting' | 'done' | 'error'

export interface BatchItem {
  id: string
  file: File
  status: ItemStatus
  uploadPercent: number
  phase: Phase
  progress: ProgressState
  result: ConvertedFile | null
  error: string
}

const IDLE_PROGRESS: ProgressState = { percent: 0, fps: 0, speed: '?', currentTime: 0, duration: 0 }

const VIDEO_EXT = /\.(mp4|mkv|mov|m4v|webm|avi|ts|m2ts|mts|mxf|wmv|flv)$/i

// Every encoder being busy is normal under load, not a failure. Retrying lets
// the platform route the request to an instance with a free slot.
const BUSY_RETRIES = 40

function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // randomUUID is missing outside secure contexts, e.g. the dev server opened
  // over a LAN address. Same format, built by hand.
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

const newItem = (file: File): BatchItem => ({
  id: randomId(),
  file,
  status: 'ready',
  uploadPercent: 0,
  phase: 'fetching',
  progress: IDLE_PROGRESS,
  result: null,
  error: '',
})

/**
 * Sends the video straight to storage. It never passes through the API: the
 * server only signs a one-time upload URL for a random name, so the real
 * filename stays in this tab.
 */
async function uploadVideo(file: File, onProgress: (percent: number) => void, signal: AbortSignal) {
  const ext = file.name.match(VIDEO_EXT)?.[0].toLowerCase() ?? '.mp4'
  const pathname = `uploads/${randomId()}${ext}`
  try {
    await uploadPresigned(pathname, file, {
      access: 'private',
      handleUploadUrl: '/api/upload-url',
      contentType: file.type.startsWith('video/') ? file.type : 'application/octet-stream',
      // Parts upload in parallel and retry on their own, which matters on a
      // phone connection that drops for a second halfway through. The SDK
      // sends 8 MB parts six at a time, so anything over two parts is faster
      // this way than as one long request on a single connection.
      multipart: file.size > 16 * 1024 * 1024,
      abortSignal: signal,
      onUploadProgress: (e) => onProgress(Math.round(e.percentage)),
    })
  } catch (e) {
    if (signal.aborted) throw new Error('Upload cancelled.')
    console.error(e)
    throw new Error('The upload failed. Check your connection and try again.')
  }
  return pathname
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('Cancelled.')) }, { once: true })
  })

/**
 * Runs the whole conversion as one streamed request and reports each NDJSON
 * line. Resolves with the finished file, or throws with a message to show.
 */
async function convertVideo(
  pathname: string,
  resolution: Resolution,
  onEvent: (e: ConvertEvent) => void,
  signal: AbortSignal
): Promise<ConvertedFile> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pathname, resolution }),
      signal,
    })

    if (!res.ok || !res.body) {
      const body = await res.json().catch(() => null)
      if (res.status === 503 && body?.busy && attempt < BUSY_RETRIES) {
        onEvent({ waiting: true })
        await sleep(Number(res.headers.get('Retry-After') ?? 5) * 1000, signal)
        continue
      }
      if (res.status === 503 && body?.busy) throw new Error('The server is busy. Please try again in a few minutes.')
      throw new Error(body?.error ?? `Could not start the conversion (HTTP ${res.status}).`)
    }

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
    let buffer = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue // heartbeat
        const event: ConvertEvent = JSON.parse(line)
        if (event.error) throw new Error(event.error)
        if (event.done && event.pathname && event.downloadUrl) {
          return { pathname: event.pathname, downloadUrl: event.downloadUrl }
        }
        onEvent(event)
      }
    }
    throw new Error('The connection to the server was lost before the conversion finished.')
  }
}

export default function ConverterApp() {
  const config = useServerConfig()

  const [stage, setStage] = useState<Stage>('upload')
  const [items, setItems] = useState<BatchItem[]>([])
  // Why a picked file was left out. Shown until the next pick.
  const [notice, setNotice] = useState('')
  // Kept across "convert another", since it is a preference rather than part
  // of one job.
  const [resolution, setResolution] = useState<Resolution>('original')
  const addInputRef = useRef<HTMLInputElement>(null)

  // One controller covers every upload and conversion in the batch. Aborting it
  // closes the requests, which is the server's signal to kill FFmpeg and delete.
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  const update = (id: string, patch: Partial<BatchItem>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))

  const addFiles = async (incoming: File[]) => {
    const notes: string[] = []
    const accepted: File[] = []
    let overflow = 0
    // Reads only each file's colour tags, so this is quick even for 3 large
    // files. Only a clear SDR verdict stops one; the server checks the rest.
    const verdicts = await Promise.all(incoming.map((f) => (checkVideo(f, config) ? null : probeHdr(f))))
    incoming.forEach((f, i) => {
      const problem = checkVideo(f, config)
      if (problem) notes.push(problem)
      else if (verdicts[i] === 'sdr') {
        notes.push(`${f.name} is not HDR, so there is nothing to convert. It should already look right on any screen.`)
      }
      else if (items.length + accepted.length < MAX_FILES) accepted.push(f)
      else overflow++
    })
    if (overflow) {
      notes.push(`You can convert up to ${MAX_FILES} videos at a time, so ${overflow} ${overflow === 1 ? 'was' : 'were'} left out.`)
    }
    setNotice(notes.join(' '))
    if (accepted.length) {
      setItems((prev) => [...prev, ...accepted.map(newItem)])
      setStage('options')
    }
  }

  const removeItem = (id: string) => {
    const left = items.filter((it) => it.id !== id)
    setItems(left)
    setNotice('')
    if (left.length === 0) setStage('upload')
  }

  const handleConvert = async () => {
    const batch = items
    if (batch.length === 0) return

    const controller = new AbortController()
    abortRef.current = controller
    const { signal } = controller
    setStage('working')
    setNotice('')

    // A reset or unmount aborted the run on purpose; there is nothing to report.
    const fail = (id: string, e: unknown) => {
      if (!signal.aborted) update(id, { status: 'error', error: (e as Error).message })
    }

    const convertOne = async (item: BatchItem, pathname: string) => {
      if (signal.aborted) return
      update(item.id, { status: 'converting', phase: 'fetching', progress: IDLE_PROGRESS })
      try {
        const result = await convertVideo(pathname, resolution, (event) => {
          if (event.waiting) return update(item.id, { phase: 'waiting' })
          if (event.stage) return update(item.id, { phase: event.stage })
          update(item.id, {
            phase: 'encoding',
            progress: {
              percent: event.percent ?? 0,
              fps: event.fps ?? 0,
              speed: event.speed ?? '?',
              currentTime: event.currentTime ?? 0,
              duration: event.duration ?? 0,
            },
          })
        }, signal)
        update(item.id, { status: 'done', result })
      } catch (e) {
        fail(item.id, e)
      }
    }

    // Uploads and conversions overlap: the next video uploads while the current
    // one converts. Conversions run one at a time, since each instance has one
    // encoder. Only one upload is ever left waiting, because the server sweeps
    // any upload older than the retention window, and a third video uploaded up
    // front could be gone before its turn came.
    const conversions: Promise<void>[] = []
    for (let i = 0; i < batch.length; i++) {
      if (i >= 2) await conversions[i - 2]
      if (signal.aborted) return
      const item = batch[i]
      const before = conversions[i - 1] ?? Promise.resolve()
      update(item.id, { status: 'uploading', uploadPercent: 0 })
      try {
        const pathname = await uploadVideo(item.file, (p) => update(item.id, { uploadPercent: p }), signal)
        update(item.id, { status: 'queued' })
        conversions[i] = before.then(() => convertOne(item, pathname))
      } catch (e) {
        fail(item.id, e)
        conversions[i] = before
      }
    }
  }

  const reset = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setStage('upload')
    setItems([])
    setNotice('')
  }

  const idle = stage === 'upload'
  const working = stage === 'working'
  const single = items.length === 1 ? items[0] : null
  const allFinished = items.length > 0 && items.every((i) => i.status === 'done' || i.status === 'error')
  // A single video keeps the options card on screen while it uploads, as before.
  const showOptions = stage === 'options' ||
    (working && single !== null && (single.status === 'ready' || single.status === 'uploading'))
  const uploadingSingle = single?.status === 'uploading' ? single.uploadPercent : null

  const noticeBox = notice && (
    <p
      className="mt-6 text-sm px-4 py-3 rounded-lg inline-block rise text-left"
      role="alert"
      style={{ background: 'var(--bad-tint)', border: '1px solid #fecdca', color: 'var(--bad)' }}
    >
      {notice}
    </p>
  )

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
            {idle && <UploadZone onFilesSelected={addFiles} config={config} />}
            {idle && noticeBox}
          </div>
        </div>

        {/* Working panel, shown once a file is in hand. */}
        {!idle && (
          <div className="max-w-xl mx-auto card p-5 sm:p-7 rise">
            {showOptions && (
              <div>
                <ul className="pb-5 mb-5 space-y-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3.5">
                      <span
                        className="inline-flex items-center justify-center w-11 h-11 rounded-[10px] shrink-0"
                        style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M15 10l4.5-2.5v9L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <rect x="3" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                      </span>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>
                          {item.file.name}
                        </p>
                        <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                          {formatBytes(item.file.size)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={working}
                        className="text-[13px] font-medium px-3 py-2 rounded-lg shrink-0 transition-colors"
                        style={{ color: 'var(--text-3)' }}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>

                {!working && items.length < MAX_FILES && (
                  <div className="-mt-1 mb-5">
                    <input
                      ref={addInputRef}
                      type="file"
                      accept="video/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? [])
                        e.target.value = ''
                        if (files.length) addFiles(files)
                      }}
                    />
                    <button
                      onClick={() => addInputRef.current?.click()}
                      className="text-[13px] font-semibold"
                      style={{ color: 'var(--brand)' }}
                    >
                      + Add another video ({items.length} of {MAX_FILES})
                    </button>
                  </div>
                )}
                {noticeBox && <div className="-mt-6 mb-5">{noticeBox}</div>}

                <OptionsPanel
                  inputName={items[0]?.file.name ?? ''}
                  config={config}
                  resolution={resolution}
                  onResolutionChange={setResolution}
                  disabled={working}
                />

                {uploadingSingle !== null && (
                  <div className="mt-6">
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Uploading</span>
                      <span className="text-sm font-bold mono" style={{ color: 'var(--brand)' }}>{uploadingSingle}%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${uploadingSingle}%` }} />
                    </div>
                  </div>
                )}

                <button
                  onClick={handleConvert}
                  disabled={working}
                  className="btn btn-primary w-full mt-6 text-base"
                  style={{ minHeight: '54px' }}
                  id="convert-btn"
                >
                  {uploadingSingle !== null
                    ? `Uploading ${uploadingSingle}%`
                    : items.length > 1 ? `Convert ${items.length} videos to SDR` : 'Convert to SDR'}
                </button>
              </div>
            )}

            {/* One video keeps the full-size progress, result and error views. */}
            {working && single && (single.status === 'queued' || single.status === 'converting') && (
              <ProgressBar {...single.progress} phase={single.status === 'queued' ? 'fetching' : single.phase} />
            )}

            {working && single?.status === 'done' && single.result && (
              <div>
                <DownloadCard
                  file={single.result}
                  originalName={single.file.name}
                  retentionMinutes={config.retentionMinutes}
                  downscaled={resolution === '1080p'}
                />
                <button onClick={reset} className="btn btn-secondary w-full mt-5" id="convert-another-btn">
                  Convert another video
                </button>
              </div>
            )}

            {working && single?.status === 'error' && (
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
                  {single.error}
                </p>
                <p className="text-[13px] mt-3" style={{ color: 'var(--text-3)' }}>
                  Whatever went wrong, your video has already been deleted from the server.
                </p>
                <button onClick={reset} className="btn btn-secondary w-full mt-6">
                  Try again
                </button>
              </div>
            )}

            {/* Two or three videos share one list. */}
            {working && items.length > 1 && (
              <div>
                <BatchList items={items} retentionMinutes={config.retentionMinutes} />
                {allFinished && (
                  <button onClick={reset} className="btn btn-secondary w-full mt-5" id="convert-another-btn">
                    Convert more videos
                  </button>
                )}
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
