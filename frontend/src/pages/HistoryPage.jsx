import { useEffect, useState } from 'react'
import api from '../api/client'
import { money, quantity } from '../utils/format'

export default function HistoryPage() {
  const [type, setType] = useState('magazzino')
  const [rows, setRows] = useState([])
  useEffect(() => { api.get(`/history?type=${type === 'cassa' ? 'cassa' : ''}`).then(({ data }) => setRows(data.data)) }, [type])
  return (
    <section>
      <div className="page-title"><h1>Movimenti</h1><select className="form-select w-auto" value={type} onChange={(e) => setType(e.target.value)}><option>magazzino</option><option>cassa</option></select></div>
      <div className="app-card">
        {rows.map((row) => <div className="list-row" key={row.id}>
          {type === 'cassa'
            ? `${row.member?.name || '-'} · ${row.user?.name || '-'} · ${row.direction} · ${money(row.amount_cents)} · ${row.description}`
            : `${row.user?.name} · ${row.withdrawal?.actor?.name || '-'} · ${row.type} · ${row.product?.name} · ${quantity(row.quantity)}`}
        </div>)}
      </div>
    </section>
  )
}
