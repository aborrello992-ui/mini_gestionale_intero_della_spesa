import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/client'
import Loading from '../components/Loading'
import { money, quantity } from '../utils/format'

export default function DashboardPage() {
  const [data, setData] = useState(null)

  useEffect(() => { api.get('/dashboard').then(({ data }) => setData(data)) }, [])
  if (!data) return <Loading />

  return (
    <section>
      <div className="page-title">
        <h1>Dashboard</h1>
        <Link className="btn btn-primary" to="/withdraw">Prelievo rapido</Link>
      </div>
      <div className="metric-grid">
        <div className="metric"><span>Cassa</span><strong>{money(data.cash_balance_cents)}</strong></div>
        <div className="metric"><span>Prodotti attivi</span><strong>{data.active_products_count}</strong></div>
        <div className="metric"><span>Sotto scorta</span><strong>{data.low_stock_count}</strong></div>
        <div className="metric"><span>Esauriti</span><strong>{data.out_of_stock_count}</strong></div>
      </div>
      <div className="row g-3 mt-1">
        <div className="col-lg-6"><List title="Ultimi movimenti magazzino" rows={data.latest_inventory_movements.map((m) => `${m.user?.name} · ${m.type} · ${m.product?.name} · ${quantity(m.quantity)}`)} /></div>
        <div className="col-lg-6"><List title="Ultimi movimenti cassa" rows={data.latest_cash_movements.map((m) => `${m.user?.name} · ${m.direction} · ${money(m.amount_cents)} · ${m.description}`)} /></div>
        <div className="col-12"><List title="Prodotti più prelevati" rows={data.top_withdrawn_products.map((m) => `${m.product?.name}: ${quantity(m.total_quantity, m.product?.unit)}`)} /></div>
      </div>
    </section>
  )
}

function List({ title, rows }) {
  return <div className="app-card"><h2 className="h5">{title}</h2>{rows.length ? rows.map((row) => <div className="list-row" key={row}>{row}</div>) : <p className="text-secondary mb-0">Nessun movimento.</p>}</div>
}
