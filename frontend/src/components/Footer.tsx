export default function Footer() {
  return (
    <footer
      className="border-t mt-10 sm:mt-16"
      style={{ borderColor: 'var(--border)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <p className="text-xs sm:text-sm text-center md:text-left" style={{ color: 'var(--text-muted)' }}>
          HDR2SDR — converts HDR video to SDR using the Hable tone-mapping pipeline
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
          <a href="https://ffmpeg.org/documentation.html" target="_blank" rel="noopener noreferrer"
            className="hover:underline transition-colors" style={{ color: 'var(--accent-light)' }}>
            FFmpeg Docs ↗
          </a>
          <span aria-hidden="true">•</span>
          <span>libx265 / HEVC</span>
          <span aria-hidden="true">•</span>
          <span>BT.709 Output</span>
        </div>
      </div>
    </footer>
  )
}
