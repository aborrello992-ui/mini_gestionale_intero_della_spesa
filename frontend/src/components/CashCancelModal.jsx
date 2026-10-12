import { useId, useState } from 'react'
import { Ban } from 'lucide-react'
import api from '../api/client'
import AppModal from './ui/AppModal'
import FormField from './forms/FormField'
import { errorMessage, money, movementDateTime, quantity } from '../utils/format'

const signed = (row) => `${row.direction === 'entrata' ? '+' : '−'}${money(row.amount_cents)}`
const loads = (row) => (row.stock_loads || []).map((load) => `${quantity(load.quantity, load.unit)} di ${load.product}`).join(', ')

/** Pulsante "Annulla" del movimento, oppure il motivo per cui non si può annullare. */
export function CashCancelButton({ row, isAdmin, onClick, className = '' }) {
  if (!isAdmin || row.status !== 'active') return null
  if (row.cancel_block_reason) return <div className={`small text-muted-app ${className}`}>{row.cancel_block_reason}</div>
  return (
    <button type="button" className={`btn btn-sm btn-outline-danger ${className}`} onClick={() => onClick(row)} aria-label={`Annulla movimento ${row.description || row.type} di ${money(row.amount_cents)}`}>
      <Ban size={15} aria-hidden="true" /> Annulla
    </button>
  )
}

function preview(row, removeStock) {
  const lines = [row.direction === 'entrata'
    ? `Il saldo di cassa scende di ${money(row.amount_cents)}.`
    : `Il saldo di cassa torna su di ${money(row.amount_cents)}.`]
  if (row.stock_loads?.length) lines.push(removeStock ? `Dal magazzino escono: ${loads(row)}.` : 'Il magazzino non cambia: la merce resta caricata.')
  lines.push('Il movimento resta in elenco come annullato, insieme al movimento che lo compensa.')
  return lines
}

/** Annulla un'entrata o un'uscita registrata per sbaglio, con motivo e (se c'è) scelta sulla merce caricata. */
export default function CashCancelModal({ row, onClose, onDone }) {
  const fieldId = useId()
  const [reason, setReason] = useState('')
  const [removeStock, setRemoveStock] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await api.post(`/cash/movements/${row.id}/reverse`, { reason, remove_stock: removeStock })
      onDone(`Movimento di ${money(row.amount_cents)} annullato.`)
    } catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }

  return (
    <AppModal title="Annulla movimento" subtitle={`${row.description || row.type?.replaceAll('_', ' ')} · ${signed(row)} · ${movementDateTime(row)}${row.member?.name ? ` · ${row.member.name}` : ''}`} onClose={() => !saving && onClose()} labelledBy="cash-cancel-title">
      <form className="stack-md" onSubmit={submit}>
        {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}
        <FormField label="Motivo" htmlFor={`${fieldId}-reason`}><input id={`${fieldId}-reason`} className="form-control" minLength={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} required autoFocus placeholder="Es. uscita registrata due volte" /></FormField>
        {row.stock_loads?.length > 0 && <div className="form-check">
          <input id={`${fieldId}-stock`} className="form-check-input" type="checkbox" checked={removeStock} onChange={(e) => setRemoveStock(e.target.checked)} />
          <label className="form-check-label" htmlFor={`${fieldId}-stock`}>Togli anche la merce caricata con questo movimento ({loads(row)})</label>
          <div className="form-text">Lascialo spento se la merce è davvero in magazzino e sbagliato è solo l'importo in cassa.</div>
        </div>}
        <div className="summary-box stack-sm" aria-live="polite">{preview(row, removeStock).map((line) => <div key={line}>{line}</div>)}</div>
        <button className="btn btn-danger btn-lg" disabled={saving || reason.trim().length < 3}>{saving ? 'Attendi…' : 'Conferma annullamento'}</button>
      </form>
    </AppModal>
  )
}
