import Header from './components/Header'
import ConverterApp from './components/ConverterApp'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="min-h-screen min-h-dvh flex flex-col">
      <Header />
      <main className="flex-1">
        <ConverterApp />
      </main>
      <Footer />
    </div>
  )
}
