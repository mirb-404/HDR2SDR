import Header from './components/Header'
import ConverterApp from './components/ConverterApp'
import Footer from './components/Footer'
import { Analytics } from '@vercel/analytics/react'

export default function App() {
  return (
    <div className="min-h-screen min-h-dvh flex flex-col">
      <Header />
      <main className="flex-1">
        <ConverterApp />
      </main>
      <Footer />
      {/* Anonymous page-view counts, no cookies. Served from this site's own
          domain, so the strict CSP needs no change. */}
      <Analytics />
    </div>
  )
}
