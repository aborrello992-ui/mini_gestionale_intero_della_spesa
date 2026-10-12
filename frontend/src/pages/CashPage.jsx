import { useCallback, useEffect, useId, useState } from 'react'
import { Ban, Banknote, PackageSearch, ReceiptText } from 'lucide-react'
import api from '../api/client'
import { errorMessage, money, movementDateTime, movementStatusLabel, quantity } from '../utils/format'
import PageHeader from '../components/layout/PageHeader'
import MetricCard from '../components/ui/MetricCard'
import DataTable from '../components/tables/DataTable'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingSkeleton from '../components/feedback/LoadingSkeleton'
import FormField from '../components/forms/FormField'
import AlertMessage from '../components/AlertMessage'
import AppModal from '../components/ui/AppModal'
import { useAuth } from '../hooks/useAuth'

const signed = (row) => `${row.direction === 'entrata' ? '+' : '−'}${money(row.amount_cents)}`

// Cosa succede annullando: mostrato prima di confermare.
function cancelPreview(row, removeStock) {
  const lines = [row.direction === 'entrata'
    ? `Il saldo di cassa scende di ${money(row.amount_cents)}.`
    : `Il saldo di cassa torna su di ${money(row.amount_cents)}.`]
  if (row.stock_loads?.length) {
    lines.push(removeStock
      ? `Dal magazzino escono: ${row.stock_loads.map((load) => `${quantity(load.quantity, load.unit)} di ${load.product}`).join(', ')}.`
      : 'Il magazzino non cambia: la merce resta caricata.')
  }
  lines.push('Il movimento resta in elenco come annullato, insieme al movimento che lo compensa.')
  return lines
}

export default function CashPage() {
  const [counters, setCounters] = useState(null)
  const [rows, setRows] = useState([])
  const [filters, setFilters] = useState({ direction: '', type: '' })
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const fieldId = useId()
  const [message, setMessage] = useState({ type: 'success', text: '' })
  const [cancelRow, setCancelRow] = useState(null)
  const [reason, setReason] = useState('')
  const [removeStock, setRemoveStock] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
    const [balance, movements] = await Promise.all([api.get('/cash/balance'), api.get(`/cash/movements?${params}`)])
    setCounters(balance.data); setRows(movements.data.data)
  }, [filters])

  useEffect(() => { load() }, [load])

  function openCancel(row) {
    setCancelRow(row); setReason(''); setRemoveStock(false)
  }

  async function submitCancel(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await api.post(`/cash/movements/${cancelRow.id}/reverse`, { reason, remove_stock: removeStock })
      setMessage({ type: 'success', text: `Movimento di ${money(cancelRow.amount_cents)} annullato.` })
      setCancelRow(null)
      load()
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) } finally { setSaving(false) }
  }

  const canCancel = (row) => isAdmin && row.status === 'active' && !row.cancel_block_reason
  const cancelButton = (row, className = '') => canCancel(row) && (
    <button type="button" className={`btn btn-sm btn-outline-danger ${className}`} onClick={() => openCancel(row)} aria-label={`Annulla movimento ${row.description || row.type} di ${money(row.amount_cents)}`}><Ban size={15} aria-hidden="true" /> Annulla</button>
  )

  const columns = [
    { key: 'date', header: 'Data', render: (row) => movementDateTime(row) },
    { key: 'movement', header: 'Movimento', render: (row) => <div><strong>{row.description || row.type}</strong><div className="small text-muted-app">{row.member?.name || row.product?.name || 'Movimento cassa'}</div></div> },
    { key: 'type', header: 'Tipo', render: (row) => <StatusBadge status={row.direction}>{row.direction}</StatusBadge> },
    { key: 'in', header: 'Entrata', align: 'right', render: (row) => row.direction === 'entrata' ? `+${money(row.amount_cents)}` : '—' },
    { key: 'out', header: 'Uscita', align: 'right', render: (row) => row.direction === 'uscita' ? `−${money(row.amount_cents)}` : '—' },
    { key: 'user', header: 'Registrato da', render: (row) => row.user?.name || '-' },
    { key: 'status', header: 'Stato', render: (row) => <StatusBadge status={row.is_opening_historical_record ? 'storico' : row.status === 'active' ? 'active' : 'annullato'}>{row.is_opening_historical_record ? 'Storico' : movementStatusLabel(row.status)}</StatusBadge> },
    ...(isAdmin ? [{ key: 'actions', header: '', align: 'right', render: (row) => cancelButton(row) }] : []),
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
      <AlertMessage type={message.type}>{message.text}</AlertMessage>
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
            <div className="split"><span className="text-muted-app">{movementDateTime(row)}</span><strong className="num">{row.direction === 'entrata' ? '+' : '−'}{money(row.amount_cents)}</strong></div>
            <div className="small text-muted-app">{row.user?.name || '-'} · {row.is_opening_historical_record ? 'Storico già contabilizzato' : movementStatusLabel(row.status)}</div>
            {cancelButton(row, 'mt-1')}
          </>
        )}
      />

      {cancelRow && <AppModal title="Annulla movimento" subtitle={`${cancelRow.description || cancelRow.type} · ${signed(cancelRow)} · ${movementDateTime(cancelRow)}`} onClose={() => !saving && setCancelRow(null)} labelledBy="cash-cancel-title">
        <form className="stack-md" onSubmit={submitCancel}>
          <FormField label="Motivo" htmlFor={`${fieldId}-reason`}><input id={`${fieldId}-reason`} className="form-control" minLength={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Es. uscita registrata due volte" /></FormField>
          {cancelRow.stock_loads?.length > 0 && <div className="form-check">
            <input id={`${fieldId}-stock`} className="form-check-input" type="checkbox" checked={removeStock} onChange={(e) => setRemoveStock(e.target.checked)} />
            <label className="form-check-label" htmlFor={`${fieldId}-stock`}>Togli anche la merce caricata con questo movimento ({cancelRow.stock_loads.map((load) => `${quantity(load.quantity, load.unit)} di ${load.product}`).join(', ')})</label>
            <div className="form-text">Lascialo spento se la merce è davvero in magazzino e sbagliato è solo l'importo in cassa.</div>
          </div>}
          <div className="summary-box stack-sm" aria-live="polite">{cancelPreview(cancelRow, removeStock).map((line) => <div key={line}>{line}</div>)}</div>
          <button className="btn btn-danger btn-lg" disabled={saving || reason.trim().length < 3}>{saving ? 'Attendi…' : 'Conferma annullamento'}</button>
        </form>
      </AppModal>}
    </section>
  )
}
