import { useState } from 'react'
import type { ConvertedFile } from './components/ConverterApp'

/**
 * Fetches a finished file into the tab, asks the server to delete its copy, and
 * saves it under the original name. Shared by the single result card and by
 * each row of a batch.
 */
export function useDownload(file: ConvertedFile, originalName: string) {
  const [downloading, setDownloading] = useState(false)
  const [failed, setFailed] = useState('')
  const [collected, setCollected] = useState(false)

  const handleDownload = async () => {
    setDownloading(true)
    setFailed('')
    let url: string | null = null
    try {
      // A short-lived signed link straight to storage. Function responses are
      // capped at 4.5 MB, so the video cannot come back through the API.
      const res = await fetch(file.downloadUrl)
      if (!res.ok) {
        throw new Error(res.status === 403 || res.status === 404
          ? 'That file is no longer available.'
          : `Download failed (HTTP ${res.status}).`)
      }
      const blob = await res.blob()

      // It is in this tab's memory now, so the stored copy can go. A failure
      // here is not the user's problem: the retention timer deletes it anyway.
      fetch('/api/discard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname: file.pathname }),
        keepalive: true,
      }).catch(() => {})

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

  return { handleDownload, downloading, failed, collected }
}
