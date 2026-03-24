export default function Header() {
  return (
    <header className="border-b" style={{ borderColor: 'var(--border)', background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(12px)' }}>
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #3b82f6)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="currentColor" opacity="0.9"/>
              <path d="M2 17l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6"/>
              <path d="M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.4"/>
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight" style={{ color: 'var(--text-primary)' }}>
              HDR<span style={{ color: 'var(--accent-light)' }}>2</span>SDR
            </h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>FFmpeg Tone Mapper</p>
          </div>
        </div>

        {/* Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: 'var(--accent-light)' }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent-light)' }}></span>
          Powered by FFmpeg
        </div>
      </div>
    </header>
  )
}
