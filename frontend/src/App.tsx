import Header from './components/Header'
import ConverterApp from './components/ConverterApp'
import Footer from './components/Footer'

export default function App() {
  return (
    <div className="gradient-bg min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 w-full flex justify-center">
        <ConverterApp />
      </main>
      <Footer />
    </div>
  )
}
