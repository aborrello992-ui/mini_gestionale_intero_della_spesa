import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return <section className="app-card"><h1>Pagina non trovata</h1><Link to="/">Torna alla dashboard</Link></section>
}
