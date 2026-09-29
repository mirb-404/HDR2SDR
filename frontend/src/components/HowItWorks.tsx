interface Props {
  maxUploadLabel: string
  retentionMinutes: number
}

export default function HowItWorks({ maxUploadLabel, retentionMinutes }: Props) {
  const steps = [
    {
      title: 'Pick your video',
      body: `Choose a file up to ${maxUploadLabel}, or drag it anywhere onto the page. No account needed.`,
    },
    {
      title: 'We convert it',
      body: 'Usually a minute or two. You can watch the progress, and the original is wiped as soon as it finishes.',
    },
    {
      title: 'Download and done',
      body: `Your video is deleted the moment you save it, and erased within ${retentionMinutes} minutes either way.`,
    },
  ]

  return (
    <section id="how">
      <div className="text-center mb-10">
        <h2 className="text-2xl sm:text-[28px] font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
          Three steps, about a minute
        </h2>
      </div>

      <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
        {steps.map(({ title, body }, i) => (
          <div key={title} className="text-center sm:text-left">
            <span
              className="inline-flex items-center justify-center w-10 h-10 rounded-full font-extrabold text-[15px] mb-4"
              style={{ background: 'var(--brand-tint)', color: 'var(--brand)' }}
            >
              {i + 1}
            </span>
            <p className="font-bold text-[15px] mb-1.5" style={{ color: 'var(--text)' }}>{title}</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
