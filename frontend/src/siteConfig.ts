/**
 * Everything about "who made this" and "what are the limits" lives here, so
 * there is exactly one place to edit when any of it changes.
 */

// ── Attribution ──────────────────────────────────────────────────────────────
// Change the name or the links here and every place they appear in the UI
// updates — header, footer and the privacy section's "read the source" link.
export const AUTHOR = {
  name: 'Mirang Bhandari',
  githubUser: 'mirb-404',
  profileUrl: 'https://github.com/mirb-404',
  repoUrl: 'https://github.com/mirb-404/HDR2SDR',
} as const

// ── Server limits ────────────────────────────────────────────────────────────
// These are only the values shown before /api/config answers. The server is the
// source of truth; see useServerConfig below.
export interface ServerConfig {
  maxUploadBytes: number
  maxUploadLabel: string
  retentionMinutes: number
  codec: string
  crf: number
  preset: string
  audio: string
}

export const FALLBACK_CONFIG: ServerConfig = {
  maxUploadBytes: 500 * 1024 * 1024,
  maxUploadLabel: '500 MB',
  retentionMinutes: 15,
  codec: 'H.264 (libx264)',
  crf: 20,
  preset: 'fast',
  audio: 'AAC 192k',
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}
