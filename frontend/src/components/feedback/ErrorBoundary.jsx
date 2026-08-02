import { Component } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error) {
    console.error('Frontend error boundary', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="login-page">
        <section className="error-state" style={{ width: 'min(100%, 560px)' }}>
          <div className="error-state-icon"><AlertTriangle size={22} /></div>
          <h1 className="h4 mb-0">Qualcosa non ha funzionato</h1>
          <p className="mb-0">La pagina non è riuscita a caricarsi correttamente. Puoi riprovare o tornare ai prodotti.</p>
          <div className="cluster">
            <button className="btn btn-primary" onClick={() => window.location.reload()}><RotateCcw size={17} /> Riprova</button>
            <a className="btn btn-outline-secondary" href="/products">Torna ai prodotti</a>
          </div>
        </section>
      </main>
    )
  }
}
