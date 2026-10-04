import { estimateRemaining } from '../eta'
import { useDownload } from '../useDownload'
import type { BatchItem, ConvertedFile } from './ConverterApp'
import { formatBytes } from '../siteConfig'

interface Props {
  items: BatchItem[]
  retentionMinutes: number
}

/**
 * Several videos at once. Each row carries its own progress and, once it is
 * done, its own download, so nobody has to wait for the last one to finish
 * before collecting the first. That matters because each result is only kept
 * for the retention window.
 */
export default function BatchList({ items, retentionMinutes }: Props) {
  const finished = items.filter((i) => i.status === 'done' || i.status === 'error').length
  const failed = items.filter((i) => i.status === 'error').length
  const allFinished = finished === items.length

  const heading = !allFinished
    ? `Converting ${items.length} videos`
    : failed === 0
      ? 'All your videos are ready'
      : failed === items.length
        ? 'None of those worked'
        : `${items.length - failed} of ${items.length} are ready`

  return (
    <div className="rise">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="text-base font-bold" style={{ color: 'var(--text)' }}>{heading}</h2>
        {!allFinished && (
          <span className="text-sm mono" style={{ color: 'var(--text-3)' }}>
            {finished} of {items.length} done
          </span>
        )}
      </div>

      <ul className="space-y-3">
        {items.map((item) => (
          <Row key={item.id} item={item} />
        ))}
      </ul>

      <p className="text-[13px] mt-5 leading-relaxed" style={{ color: 'var(--text-3)' }}>
        {allFinished
          ? `Download each one now. A file is deleted the moment you download it, and erased within ${retentionMinutes} minutes either way.`
          : 'They convert one after another, and each can be downloaded as soon as it is ready. Keep this tab open.'}
      </p>
    </div>
  )
}

function Row({ item }: { item: BatchItem }) {
  const { status, phase, progress } = item

  let label = ''
  let percent: number | null = null
  let detail = ''

  if (status === 'ready') label = 'Waiting to upload'
  else if (status === 'uploading') {
    label = `Uploading ${item.uploadPercent}%`
    percent = item.uploadPercent
  } else if (status === 'queued') label = 'Uploaded, next in line'
  else if (status === 'converting') {
    if (phase === 'waiting') label = 'Waiting for a free encoder'
    else if (phase === 'fetching') label = 'Getting it ready'
    else if (phase === 'saving') {
      label = 'Saving'
      percent = 100
    } else {
      label = `Converting ${progress.percent}%`
      percent = progress.percent
      detail = estimateRemaining(progress.currentTime, progress.duration, progress.speed) ?? 'Estimating time left'
    }
  }

  return (
    <li className="rounded-[10px] px-4 py-3" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{item.file.name}</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-3)' }}>{formatBytes(item.file.size)}</p>
        </div>
        {status === 'done' && item.result
          ? <DownloadButton file={item.result} originalName={item.file.name} />
          : status !== 'error' && (
            <span className="text-[13px] font-medium text-right shrink-0" style={{ color: 'var(--text-2)' }}>
              {label}
            </span>
          )}
      </div>

      {percent !== null && (
        <div className="progress-track mt-2.5" role="progressbar" aria-valuenow={percent}
          aria-valuemin={0} aria-valuemax={100} aria-label={`${item.file.name} progress`}>
          <div className="progress-fill" style={{ width: `${percent}%` }} />
        </div>
      )}
      {detail && (
        <p className="text-[13px] font-semibold mt-2" style={{ color: 'var(--text)' }}>{detail}</p>
      )}
      {status === 'error' && (
        <p className="text-[13px] mt-2 break-words" role="alert" style={{ color: 'var(--bad)' }}>
          {item.error} It has already been deleted from the server.
        </p>
      )}
    </li>
  )
}

function DownloadButton({ file, originalName }: { file: ConvertedFile; originalName: string }) {
  const { handleDownload, downloading, failed, collected } = useDownload(file, originalName)
  return (
    <div className="text-right shrink-0">
      <button
        onClick={handleDownload}
        disabled={downloading}
        className={`btn ${collected ? 'btn-secondary' : 'btn-primary'} text-sm`}
        style={{ minHeight: '38px', padding: '0 14px' }}
      >
        {downloading ? 'Downloading' : collected ? 'Downloaded' : 'Download'}
      </button>
      {failed && (
        <p className="text-[12px] mt-1" role="alert" style={{ color: 'var(--bad)' }}>{failed}</p>
      )}
    </div>
  )
}
