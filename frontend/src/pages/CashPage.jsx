import { useCallback, useEffect, useState } from 'react'
import { Banknote, PackageSearch, ReceiptText } from 'lucide-react'
import api from '../api/client'
import { dateTime, money } from '../utils/format'
import PageHeader from '../components/layout/PageHeader'
import MetricCard from '../components/ui/MetricCard'
import DataTable from '../components/tables/DataTable'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingSkeleton from '../components/feedback/LoadingSkeleton'
import FormField from '../components/forms/FormField'

export default function CashPage() {
  const [counters, setCounters] = useState(null)
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ direction: '', type: '' })

  const load = useCallback(async () => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
    const [balance, movements] = await Promise.all([api.get('/cash/balance'), api.get(`/cash/movements?${params}`)])
    setCounters(balance.data); setRows(movements.data.data)
  }, [filters])

  useEffect(() => { load() }, [load])

  const columns = [
    { key: 'date', header: 'Data', render: (row) => dateTime(`${row.movement_date}T${row.movement_time || '00:00'}`) },
    { key: 'movement', header: 'Movimento', render: (row) => <div><strong>{row.description || row.type}</strong><div className="small text-muted-app">{row.member?.name || row.product?.name || 'Movimento cassa'}</div></div> },
    { key: 'type', header: 'Tipo', render: (row) => <StatusBadge status={row.direction}>{row.direction}</StatusBadge> },
    { key: 'in', header: 'Entrata', align: 'right', render: (row) => row.direction === 'entrata' ? `+${money(row.amount_cents)}` : '—' },
    { key: 'out', header: 'Uscita', align: 'right', render: (row) => row.direction === 'uscita' ? `−${money(row.amount_cents)}` : '—' },
    { key: 'user', header: 'Registrato da', render: (row) => row.user?.name || '-' },
    { key: 'status', header: 'Stato', render: (row) => <StatusBadge status={row.is_opening_historical_record ? 'storico' : row.status}>{row.is_opening_historical_record ? 'Storico' : row.status}</StatusBadge> },
  ]

  return (
    <section>
      <PageHeader title="Cassa" subtitle="Controlla il saldo reale, i crediti da incassare e i movimenti contabili." />
      {!counters ? <LoadingSkeleton type="metrics" cards={3} /> : (
        <div className="metric-grid mb-3">
          <MetricCard emphasis icon={Banknote} label="Saldo attuale" value={money(counters.balance_cents || 0)} help="Denaro realmente presente in cassa." />
          <MetricCard icon={PackageSearch} tone="info" label="Valore prodotti disponibili" value={money(counters.inventory_potential_cents || 0)} help="Valore potenziale, non è denaro incassato." />
          <MetricCard icon={ReceiptText} tone="warning" label="Da incassare dai copponi" value={money(counters.open_coppone_cents || 0)} help="Crediti aperti, non inclusi nel saldo reale." />
        </div>
      )}
      <div className="app-card filter-bar">
        <FormField label="Direzione">
          <select className="form-select" value={filters.direction} onChange={(e) => setFilters({ ...filters, direction: e.target.value })}><option value="">Entrate e uscite</option><option value="entrata">Entrate</option><option value="uscita">Uscite</option></select>
        </FormField>
        <FormField label="Tipologia">
          <select className="form-select" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}><option value="">Tutte le tipologie</option>{['prodotto_pagato', 'pagamento_debito', 'spesa_locale', 'accredito', 'quota', 'correzione', 'acquisto_prodotti'].map((t) => <option key={t} value={t}>{t.replaceAll('_', ' ')}</option>)}</select>
        </FormField>
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        getKey={(row) => row.id}
        emptyTitle="Nessun movimento di cassa"
        emptyMessage="Non ci sono movimenti compatibili con i filtri selezionati."
        renderMobile={(row) => (
          <>
            <div className="split"><strong>{row.description || row.type}</strong><StatusBadge status={row.direction}>{row.direction}</StatusBadge></div>
            <div className="split"><span className="text-muted-app">{dateTime(`${row.movement_date}T${row.movement_time || '00:00'}`)}</span><strong className="num">{row.direction === 'entrata' ? '+' : '−'}{money(row.amount_cents)}</strong></div>
            <div className="small text-muted-app">{row.user?.name || '-'} · {row.is_opening_historical_record ? 'Storico già contabilizzato' : row.status}</div>
          </>
        )}
      />
    </section>
  )
}
