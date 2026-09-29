import { useEffect, useState } from 'react'
import { FALLBACK_CONFIG, type ServerConfig } from './siteConfig'

/**
 * Reads the limits the server actually enforces.
 *
 * The upload zone advertises a size cap, and the privacy text promises a
 * deletion deadline. Both are claims the server has to keep, so both are read
 * from it rather than hardcoded in two places that can quietly disagree after
 * someone changes an env var.
 */
export function useServerConfig(): ServerConfig {
  const [config, setConfig] = useState<ServerConfig>(FALLBACK_CONFIG)

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/config', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.maxUploadBytes === 'number') setConfig(data)
      })
      .catch(() => {
        // Offline or the API is down. The fallback values are the same defaults
        // the server ships with, so the UI stays truthful either way.
      })

    return () => controller.abort()
  }, [])

  return config
}
