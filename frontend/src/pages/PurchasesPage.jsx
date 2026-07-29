import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import Loading from '../components/Loading'
import { money } from '../utils/format'

export default function PurchasesPage() {
  const [data, setData] = useState(null)
  useEffect(() => { api.get('/purchases').then(({ data }) => setData(data)) }, [])
  if (!data) return <Loading />
  return (
    <section>
      <div className="page-title"><h1>Acquisti</h1><Link className="btn btn-primary" to="/purchases/new">Nuovo acquisto</Link></div>
      <div className="app-card table-responsive">
        <table className="table align-middle">
          <thead><tr><th>Data</th><th>Fornitore</th><th>Utente</th><th>Totale</th></tr></thead>
          <tbody>{data.data.map((p) => <tr key={p.id}><td>{p.purchased_at}</td><td>{p.supplier || '-'}</td><td>{p.user?.name}</td><td>{money(p.total_cents)}</td></tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}
