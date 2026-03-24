export default function Footer() {
  return (
    <footer className="border-t mt-16" style={{ borderColor: 'var(--border)' }}>
      <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          HDR2SDR — converts HDR video to SDR using the Hable tone-mapping pipeline
        </p>
        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          <a href="https://ffmpeg.org/documentation.html" target="_blank" rel="noopener noreferrer"
            className="hover:underline transition-colors" style={{ color: 'var(--accent-light)' }}>
            FFmpeg Docs ↗
          </a>
          <span>•</span>
          <span>libx265 / HEVC</span>
          <span>•</span>
          <span>BT.709 Output</span>
        </div>
      </div>
    </footer>
  )
}
