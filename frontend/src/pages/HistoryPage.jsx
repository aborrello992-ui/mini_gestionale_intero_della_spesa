import { useCallback, useEffect, useState } from 'react'
import { History, Search } from 'lucide-react'
import api from '../api/client'
import { dateTime, errorMessage, money, quantity } from '../utils/format'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/tables/DataTable'
import FormField from '../components/forms/FormField'
import StatusBadge from '../components/ui/StatusBadge'
import Pagination from '../components/Pagination'
import AlertMessage from '../components/AlertMessage'

const TYPE_LABELS = {
  prelievo: 'Prelievo',
  prelievo_pagato: 'Prelievo pagato',
  prelievo_coppone: 'Prelievo coppone',
  rifornimento: 'Rifornimento',
  acquisto: 'Acquisto',
  correzione_positiva: 'Correzione +',
  correzione_negativa: 'Correzione −',
  annullamento: 'Annullamento',
}

export default function HistoryPage() {
  const [type, setType] = useState('magazzino')
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const load = useCallback(async (pageNumber = 1) => {
    const params = new URLSearchParams({ page: pageNumber })
    if (type === 'cassa') params.set('type', 'cassa')
    if (query) params.set('search', query)
    try {
      setPage((await api.get(`/history?${params}`)).data)
      setError('')
    } catch (err) { setError(errorMessage(err)) }
  }, [type, query])

  useEffect(() => { load() }, [load])

  const rows = page?.data || []
  const cashDate = (row) => dateTime(`${String(row.movement_date).slice(0, 10)}T${row.movement_time || '00:00'}`)
  const columns = type === 'cassa'
    ? [
        { key: 'date', header: 'Data', render: cashDate },
        { key: 'title', header: 'Movimento', render: (row) => <div><strong>{row.description || row.type}</strong><div className="small text-muted-app">{row.member?.name || row.user?.name || '-'}</div></div> },
        { key: 'type', header: 'Tipo', render: (row) => <StatusBadge status={row.direction}>{row.direction}</StatusBadge> },
        { key: 'amount', header: 'Importo', align: 'right', render: (row) => `${row.direction === 'entrata' ? '+' : '−'}${money(row.amount_cents)}` },
        { key: 'status', header: 'Stato', render: (row) => <StatusBadge status={row.status === 'active' ? 'active' : 'annullato'}>{row.status === 'active' ? 'Valido' : 'Annullato'}</StatusBadge> },
      ]
    : [
        { key: 'date', header: 'Data', render: (row) => dateTime(row.created_at) },
        { key: 'title', header: 'Movimento', render: (row) => <div><strong>{row.product?.name || 'Prodotto'}</strong><div className="small text-muted-app">{row.user?.name || row.withdrawal?.actor?.name || '-'}</div></div> },
        { key: 'type', header: 'Tipo', render: (row) => <StatusBadge tone="info">{TYPE_LABELS[row.type] || row.type}</StatusBadge> },
        { key: 'quantity', header: 'Quantità', align: 'right', render: (row) => quantity(row.quantity, row.product?.unit) },
      ]

  return (
    <section>
      <PageHeader title="Storico" subtitle="Movimenti di magazzino e di cassa, dal più recente." badge={<StatusBadge tone="info">{page?.total ?? 0} movimenti</StatusBadge>} />
      <AlertMessage>{error}</AlertMessage>
      <div className="app-card filter-bar">
        <FormField label="Cerca" htmlFor="history-search">
          <div className="search-field">
            <Search size={18} aria-hidden="true" />
            <input id="history-search" className="form-control" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Prodotto, socio, descrizione" />
          </div>
        </FormField>
        <FormField label="Archivio" htmlFor="history-type">
          <select id="history-type" className="form-select" value={type} onChange={(e) => setType(e.target.value)}><option value="magazzino">Magazzino</option><option value="cassa">Cassa</option></select>
        </FormField>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getKey={(row) => row.id}
        emptyTitle="Nessun movimento trovato"
        emptyMessage="Non ci sono movimenti compatibili con la ricerca."
        renderMobile={(row) => (
          <>
            <div className="cluster"><History size={18} aria-hidden="true" /><strong>{type === 'cassa' ? row.description || row.type : row.product?.name || 'Prodotto'}</strong></div>
            <div className="split"><span className="text-muted-app">{type === 'cassa' ? cashDate(row) : dateTime(row.created_at)}</span><strong className="num">{type === 'cassa' ? `${row.direction === 'entrata' ? '+' : '−'}${money(row.amount_cents)}` : quantity(row.quantity, row.product?.unit)}</strong></div>
            <div className="small text-muted-app">{type === 'cassa' ? (row.member?.name || row.user?.name || '-') : `${TYPE_LABELS[row.type] || row.type} · ${row.user?.name || row.withdrawal?.actor?.name || '-'}`}</div>
          </>
        )}
      />
      <Pagination page={page} onPage={load} />
    </section>
  )
}
