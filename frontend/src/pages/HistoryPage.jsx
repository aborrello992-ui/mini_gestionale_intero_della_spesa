import { useEffect, useState } from 'react'
import { History, Search } from 'lucide-react'
import api from '../api/client'
import { dateTime, money, quantity } from '../utils/format'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/tables/DataTable'
import FormField from '../components/forms/FormField'
import StatusBadge from '../components/ui/StatusBadge'

export default function HistoryPage() {
  const [type, setType] = useState('magazzino')
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  useEffect(() => { api.get(`/history?type=${type === 'cassa' ? 'cassa' : ''}`).then(({ data }) => setRows(data.data)) }, [type])
  const filteredRows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(search.toLowerCase()))
  const columns = type === 'cassa'
    ? [
        { key: 'date', header: 'Data', render: (row) => dateTime(`${row.movement_date}T${row.movement_time || '00:00'}`) },
        { key: 'title', header: 'Movimento', render: (row) => <div><strong>{row.description || row.type}</strong><div className="small text-muted-app">{row.member?.name || row.user?.name || '-'}</div></div> },
        { key: 'type', header: 'Tipo', render: (row) => <StatusBadge status={row.direction}>{row.direction}</StatusBadge> },
        { key: 'amount', header: 'Importo', align: 'right', render: (row) => `${row.direction === 'entrata' ? '+' : '−'}${money(row.amount_cents)}` },
        { key: 'status', header: 'Stato', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
      ]
    : [
        { key: 'date', header: 'Data', render: (row) => dateTime(row.created_at) },
        { key: 'title', header: 'Movimento', render: (row) => <div><strong>{row.product?.name || 'Prodotto'}</strong><div className="small text-muted-app">{row.user?.name || row.withdrawal?.actor?.name || '-'}</div></div> },
        { key: 'type', header: 'Tipo', render: (row) => <StatusBadge tone="info">{row.type}</StatusBadge> },
        { key: 'quantity', header: 'Quantità', align: 'right', render: (row) => quantity(row.quantity, row.product?.unit) },
      ]

  return (
    <section>
      <PageHeader title="Storico" subtitle="Consulta movimenti di magazzino e cassa in ordine cronologico." badge={<StatusBadge tone="info">{filteredRows.length} movimenti</StatusBadge>} />
      <div className="app-card filter-bar">
        <FormField label="Cerca">
          <div className="search-field">
            <Search size={18} />
            <input className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Prodotto, utente, descrizione" />
          </div>
        </FormField>
        <FormField label="Archivio">
          <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}><option value="magazzino">Magazzino</option><option value="cassa">Cassa</option></select>
        </FormField>
      </div>
      <DataTable
        columns={columns}
        rows={filteredRows}
        getKey={(row) => row.id}
        emptyTitle="Nessun movimento trovato"
        emptyMessage="Non ci sono movimenti compatibili con la ricerca."
        renderMobile={(row) => (
          <>
            <div className="cluster"><History size={18} /><strong>{type === 'cassa' ? row.description || row.type : row.product?.name || 'Prodotto'}</strong></div>
            <div className="split"><span className="text-muted-app">{dateTime(type === 'cassa' ? `${row.movement_date}T${row.movement_time || '00:00'}` : row.created_at)}</span><strong>{type === 'cassa' ? money(row.amount_cents) : quantity(row.quantity, row.product?.unit)}</strong></div>
            <div className="small text-muted-app">{type === 'cassa' ? row.user?.name || '-' : row.user?.name || row.withdrawal?.actor?.name || '-'}</div>
          </>
        )}
      />
    </section>
  )
}
