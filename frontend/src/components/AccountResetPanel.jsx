import { useId, useState } from 'react'
import { RotateCcw, ShieldAlert } from 'lucide-react'
import api from '../api/client'
import AlertMessage from './AlertMessage'
import FormField from './forms/FormField'
import { dateTime, errorMessage, money } from '../utils/format'

const TABLE_LABELS = {
  cash_movements: 'Movimenti di cassa',
  member_debts: 'Debiti',
  debt_payments: 'Pagamenti debiti',
  withdrawals: 'Prelievi',
  restock_sessions: 'Scontrini',
  inventory_movements: 'Movimenti magazzino (solo storico)',
  sales: 'Vendite combo/divise',
}

/**
 * Azzeramento conti dall'app: anteprima obbligatoria, conferma scritta, annullabile.
 * I record precedenti al taglio vengono archiviati, mai cancellati.
 */
export default function AccountResetPanel({ resets = [], onChanged }) {
  const fieldId = useId()
  const [form, setForm] = useState({ date: '2026-10-05', time: '19:34', opening_cash: '0', expected_open_debts: '14,40' })
  const [preview, setPreview] = useState(null)
  const [confirmText, setConfirmText] = useState('')
  const [undoText, setUndoText] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState({ type: 'success', text: '' })
  const cutoff = `${form.date} ${form.time}`
  const debtsAfter = preview ? preview.members.reduce((sum, member) => sum + member.open_debt_after, 0) : 0

  async function loadPreview(event) {
    event.preventDefault()
    setBusy(true)
    setMessage({ type: 'success', text: '' })
    setConfirmText('')
    try {
      const params = new URLSearchParams({ cutoff, opening_cash: form.opening_cash })
      setPreview((await api.get(`/account-reset/preview?${params}`)).data)
    } catch (err) {
      setPreview(null)
      setMessage({ type: 'danger', text: errorMessage(err) })
    } finally { setBusy(false) }
  }

  async function execute() {
    setBusy(true)
    try {
      await api.post('/account-reset', { cutoff, opening_cash: form.opening_cash, expected_open_debts: form.expected_open_debts || null, confirm_text: confirmText })
      setMessage({ type: 'success', text: `Conti azzerati: si riparte dal ${preview.cutoff}. I dati precedenti sono qui sotto, in sola lettura.` })
      setPreview(null)
      setConfirmText('')
      onChanged?.()
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) } finally { setBusy(false) }
  }

  async function undo(reset) {
    setBusy(true)
    try {
      await api.post('/account-reset/undo', { cutoff: reset.cutoff_date.slice(0, 10), confirm_text: undoText })
      setMessage({ type: 'success', text: 'Azzeramento annullato: i dati precedenti sono di nuovo attivi.' })
      setUndoText('')
      onChanged?.()
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) } finally { setBusy(false) }
  }

  if (resets.length) {
    const reset = resets[0]
    return (
      <div className="app-card stack-sm">
        <h3 className="section-title mb-0"><ShieldAlert size={18} aria-hidden="true" /> Azzeramento conti</h3>
        <AlertMessage type={message.type}>{message.text}</AlertMessage>
        <p className="mb-0">Conti ripartiti dal <strong>{reset.cutoff_at ? dateTime(reset.cutoff_at) : reset.cutoff_date}</strong> con cassa iniziale <strong>{money(reset.opening_cash_cents)}</strong>.</p>
        <details>
          <summary className="small text-muted-app">Annulla azzeramento</summary>
          <div className="stack-sm mt-2">
            <FormField label="Scrivi ANNULLA per confermare" htmlFor={`${fieldId}-undo`}><input id={`${fieldId}-undo`} className="form-control" autoComplete="off" value={undoText} onChange={(e) => setUndoText(e.target.value)} /></FormField>
            <button type="button" className="btn btn-outline-secondary" disabled={busy || undoText !== 'ANNULLA'} onClick={() => undo(reset)}><RotateCcw size={16} /> Annulla azzeramento</button>
          </div>
        </details>
      </div>
    )
  }

  return (
    <div className="app-card stack-md">
      <div>
        <h3 className="section-title mb-1"><ShieldAlert size={18} aria-hidden="true" /> Azzera conti</h3>
        <p className="small text-muted-app mb-0">Tutto ciò che è stato inserito prima del momento scelto (scontrini, cassa, debiti, prelievi) sparisce dai conti e resta solo qui in archivio. Prodotti, quantità, utenti e PIN non cambiano.</p>
      </div>
      <AlertMessage type={message.type}>{message.text}</AlertMessage>
      <form className="restock-two" onSubmit={loadPreview}>
        <FormField label="Dal giorno" htmlFor={`${fieldId}-d`}><input id={`${fieldId}-d`} className="form-control" type="date" value={form.date} onChange={(e) => { setForm({ ...form, date: e.target.value }); setPreview(null) }} required /></FormField>
        <FormField label="Dall'ora" htmlFor={`${fieldId}-t`}><input id={`${fieldId}-t`} className="form-control" type="time" value={form.time} onChange={(e) => { setForm({ ...form, time: e.target.value }); setPreview(null) }} required /></FormField>
        <FormField label="Cassa di partenza (€)" htmlFor={`${fieldId}-o`} help="Soldi in cassa subito prima del taglio."><input id={`${fieldId}-o`} className="form-control" inputMode="decimal" value={form.opening_cash} onChange={(e) => { setForm({ ...form, opening_cash: e.target.value }); setPreview(null) }} required /></FormField>
        <FormField label="Debiti attesi dopo (€)" htmlFor={`${fieldId}-e`} help="Se non tornano, non viene scritto nulla."><input id={`${fieldId}-e`} className="form-control" inputMode="decimal" value={form.expected_open_debts} onChange={(e) => setForm({ ...form, expected_open_debts: e.target.value })} /></FormField>
        <button className="btn btn-outline-primary" disabled={busy}>{busy && !preview ? 'Calcolo…' : 'Anteprima'}</button>
      </form>

      {preview && <div className="stack-sm" aria-live="polite">
        <div className="scoreboard mb-0">
          <div><span>Saldo dopo</span><strong className="num">{money(preview.balance_after_cents)}</strong><small>prima {money(preview.balance_before_cents)}</small></div>
          <div><span>Debiti dopo</span><strong className="num">{money(debtsAfter)}</strong><small>archiviati {money(preview.open_debts_archived_cents)}</small></div>
        </div>
        <ul className="row-list">
          {Object.entries(preview.counts).map(([table, count]) => <li key={table}><span>{TABLE_LABELS[table] || table}</span><strong className="num">{count} da archiviare</strong></li>)}
        </ul>
        <h4 className="section-title mb-0">Debiti per socio</h4>
        <ul className="row-list">
          {preview.members.map((member) => <li key={member.name}><span>{member.name}</span><span className="num small">{money(member.open_debt_before)} → <strong>{money(member.open_debt_after)}</strong></span></li>)}
        </ul>
        <h4 className="section-title mb-0">Scontrini che restano</h4>
        {preview.kept_receipts.length
          ? <ul className="row-list">{preview.kept_receipts.map((receipt) => <li key={receipt.id}><span>{receipt.purchased}</span><strong className="num">{money(receipt.total_cents)}</strong></li>)}</ul>
          : <p className="text-danger fw-bold mb-0">Nessuno scontrino resterebbe: controlla data e ora.</p>}
        {preview.warnings.map((warning) => <AlertMessage type="warning" key={warning}>{warning}</AlertMessage>)}
        {preview.already_done
          ? <p className="mb-0 fw-bold">Azzeramento già eseguito per questo giorno.</p>
          : <>
            <FormField label="Scrivi AZZERA per confermare" htmlFor={`${fieldId}-c`}><input id={`${fieldId}-c`} className="form-control" autoComplete="off" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} /></FormField>
            <button type="button" className="btn btn-danger btn-lg" disabled={busy || confirmText !== 'AZZERA'} onClick={execute}>{busy ? 'Azzeramento…' : `Azzera conti prima del ${preview.cutoff}`}</button>
          </>}
      </div>}
    </div>
  )
}
