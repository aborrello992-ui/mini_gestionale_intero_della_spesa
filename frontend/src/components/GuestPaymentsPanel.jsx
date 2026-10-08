import { useState } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'
import api from '../api/client'
import AlertMessage from './AlertMessage'
import AppModal from './ui/AppModal'
import { dateTime, errorMessage, money, quantity } from '../utils/format'

/**
 * Acquisti degli ospiti da verificare: "Soldi in cassa" registra l'entrata,
 * "Non pagato" trasforma l'importo in coppone del socio garante.
 */
export default function GuestPaymentsPanel({ rows, onChanged }) {
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState({ type: 'success', text: '' })
  const total = rows.reduce((sum, row) => sum + Number(row.total_amount_cents || 0), 0)

  async function verify() {
    if (!confirm || busy) return
    setBusy(true)
    try {
      await api.post(`/withdrawals/${confirm.row.id}/verify`, { outcome: confirm.outcome })
      setMessage({ type: 'success', text: confirm.outcome === 'paid'
        ? `${money(confirm.row.total_amount_cents)} di ${confirm.row.member?.name} registrati in cassa.`
        : `${money(confirm.row.total_amount_cents)} addebitati a ${confirm.row.sponsor?.name} come coppone.` })
      setConfirm(null)
      onChanged?.()
    } catch (err) {
      setMessage({ type: 'danger', text: errorMessage(err) })
      setConfirm(null)
    } finally { setBusy(false) }
  }

  return (
    <div className="stack-md">
      <AlertMessage type={message.type}>{message.text}</AlertMessage>
      <div className="summary-box">
        <strong>{rows.length ? `${rows.length} ${rows.length === 1 ? 'acquisto' : 'acquisti'} di ospiti da verificare · ${money(total)}` : 'Nessun acquisto di ospiti da verificare.'}</strong>
        <div className="small text-muted-app">Controlla che i soldi siano in cassa. Se non ci sono, l'importo passa al socio garante come coppone.</div>
      </div>
      {rows.length > 0 && <ul className="row-list">
        {rows.map((row) => (
          <li key={row.id} className="guest-payment-row">
            <span className="min-0">
              <strong className="text-break">{row.member?.name} · {row.combo ? `★ ${row.combo.name}` : row.product?.name}</strong>
              <small>{quantity(row.quantity, row.product?.unit)} · {dateTime(row.withdrawn_at)} · garante <strong>{row.sponsor?.name || '-'}</strong></small>
            </span>
            <strong className="num">{money(row.total_amount_cents)}</strong>
            <span className="guest-payment-actions">
              <button type="button" className="btn btn-sm btn-success" onClick={() => setConfirm({ row, outcome: 'paid' })}><CheckCircle2 size={15} /> Soldi in cassa</button>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setConfirm({ row, outcome: 'unpaid' })}><XCircle size={15} /> Non pagato</button>
            </span>
          </li>
        ))}
      </ul>}

      {confirm && <AppModal title={confirm.outcome === 'paid' ? 'Soldi in cassa?' : 'Non pagato?'} subtitle={`${confirm.row.member?.name} · ${money(confirm.row.total_amount_cents)}`} onClose={() => !busy && setConfirm(null)} labelledBy="guest-payment-confirm">
        <div className="stack-md">
          <p className="mb-0">{confirm.outcome === 'paid'
            ? `Registro un'entrata di ${money(confirm.row.total_amount_cents)} in cassa per ${confirm.row.member?.name}.`
            : `${money(confirm.row.total_amount_cents)} diventano un coppone di ${confirm.row.sponsor?.name}, che ha fatto da garante.`}</p>
          <div className="product-admin-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirm(null)} disabled={busy}>Annulla</button>
            <button type="button" className={`btn ${confirm.outcome === 'paid' ? 'btn-success' : 'btn-danger'}`} onClick={verify} disabled={busy} autoFocus>{busy ? 'Attendi…' : 'Conferma'}</button>
          </div>
        </div>
      </AppModal>}
    </div>
  )
}
