import { useState, useEffect, useRef } from 'react'
import UploadZone from './UploadZone'
import OptionsPanel from './OptionsPanel'
import ProgressBar from './ProgressBar'
import DownloadCard from './DownloadCard'
import FlagExplainer from './FlagExplainer'

type Stage = 'upload' | 'options' | 'converting' | 'done' | 'error'

interface ProgressState {
  percent: number
  fps: number
  speed: string
  currentTime: number
  duration: number
}

export default function ConverterApp() {
  const [stage, setStage] = useState<Stage>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string>('')
  const [progress, setProgress] = useState<ProgressState>({ percent: 0, fps: 0, speed: '?', currentTime: 0, duration: 0 })
  const [error, setError] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  const handleFileSelected = (f: File) => {
    setFile(f)
    setStage('options')
  }

  const handleConvert = async () => {
    if (!file) return

    // Step 1: Upload file
    setUploading(true)
    setStage('options') // keep on options while uploading
    try {
      const formData = new FormData()
      formData.append('video', file)
      const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        throw new Error(err.error || 'Upload failed')
      }
      const { jobId: id } = await uploadRes.json()
      setJobId(id)
      setUploading(false)
      setStage('converting')
      setProgress({ percent: 0, fps: 0, speed: '?', currentTime: 0, duration: 0 })

      // Step 2: Open SSE before triggering convert
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
      es.onerror = () => {
        // SSE naturally closes when server ends after done; only error if not done
        if (stage !== 'done') {
          // ignore benign close
        }
      }

      // Step 3: Trigger conversion
      const convertRes = await fetch('/api/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: id }),
      })
      if (!convertRes.ok) {
        const err = await convertRes.json()
        throw new Error(err.error || 'Conversion failed to start')
      }
    } catch (e) {
      setError((e as Error).message)
      setStage('error')
      setUploading(false)
    }
  }

  const reset = () => {
    eventSourceRef.current?.close()
    setStage('upload')
    setFile(null)
    setJobId('')
    setProgress({ percent: 0, fps: 0, speed: '?', currentTime: 0, duration: 0 })
    setError('')
    setUploading(false)
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-12 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3 mb-10">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-2"
          style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: 'var(--accent-light)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          HDR → BT.709 SDR via libx265
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>
          Convert{' '}
          <span style={{ background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            HDR to SDR
          </span>
        </h1>
        <p className="text-base max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
          Upload your HDR video, and download a perfectly converted SDR MP4 using our fixed Hable tone-mapping pipeline.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3 mb-4">
        {(['upload', 'options', 'converting', 'done'] as Stage[]).map((s, i) => {
          const labels = ['Upload', 'Configure', 'Converting', 'Done']
          const isActive = stage === s
          const isDone = ['upload', 'options', 'converting', 'done'].indexOf(stage) > i
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px" style={{ background: isDone || isActive ? 'var(--accent)' : 'var(--border)' }} />}
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
        <div className="p-6 md:p-8 space-y-6">

          {/* Upload step */}
          {(stage === 'upload' || stage === 'options') && (
            <UploadZone onFileSelected={handleFileSelected} />
          )}

          {/* Options step */}
          {stage === 'options' && file && (
            <div className="fade-in-up space-y-6">
              <div className="border-t pt-6" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Conversion Options</h2>
                  <button onClick={reset} className="btn-secondary text-xs py-1.5 px-3">← Start over</button>
                </div>
                <OptionsPanel inputName={file.name} />
              </div>
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
                    Uploading…
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
            <ProgressBar {...progress} />
          )}

          {/* Done */}
          {stage === 'done' && (
            <div className="space-y-4 fade-in-up">
              <DownloadCard jobId={jobId} originalName={file?.name ?? 'video.mp4'} />
              <button onClick={reset} className="btn-secondary w-full" id="convert-another-btn">
                Convert another video
              </button>
            </div>
          )}

          {/* Error */}
          {stage === 'error' && (
            <div className="rounded-2xl p-6 fade-in-up" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.2)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ color: '#ef4444' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                    <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm" style={{ color: '#ef4444' }}>Conversion Failed</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{error}</p>
                  {error.toLowerCase().includes('ffmpeg') && (
                    <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--text-muted)' }}>
                      💡 Make sure FFmpeg is installed and available in your system PATH.
                    </p>
                  )}
                </div>
              </div>
              <button onClick={reset} className="btn-secondary mt-4 w-full">Try again</button>
            </div>
          )}
        </div>
      </div>

      {/* Flag explainer */}
      <FlagExplainer />
    </div>
  )
}
