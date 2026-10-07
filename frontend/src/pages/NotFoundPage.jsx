import { Link } from 'react-router-dom'
import PageHeader from '../components/layout/PageHeader'

export default function NotFoundPage() {
  return (
    <main className="content">
      <PageHeader title="Pagina non trovata" subtitle="Questa schermata non esiste. Continue?" />
      <Link className="btn btn-primary" to="/">Torna ai prodotti</Link>
    </main>
  )
}
