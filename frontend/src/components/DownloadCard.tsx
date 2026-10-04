import type { ConvertedFile } from './ConverterApp'
import { useDownload } from '../useDownload'

interface Props {
  file: ConvertedFile
  originalName: string
  retentionMinutes: number
  downscaled: boolean
}

export default function DownloadCard({ file, originalName, retentionMinutes, downscaled }: Props) {
  const { handleDownload, downloading, failed, collected } = useDownload(file, originalName)

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
        {downscaled
          ? 'Now at 1080p, sound kept, and it plays anywhere.'
          : 'Same size and sharpness, sound kept, and it plays anywhere.'}
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
