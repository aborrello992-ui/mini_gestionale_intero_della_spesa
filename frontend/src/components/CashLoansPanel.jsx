import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { HandCoins } from 'lucide-react'
import api from '../api/client'
import AlertMessage from './AlertMessage'
import AppModal from './ui/AppModal'
import FormField from './forms/FormField'
import UserAvatar from './ui/UserAvatar'
import { centsToInput, dateTime, errorMessage, money } from '../utils/format'

const newKey = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `loan-${Date.now()}-${Math.random()}`)

/**
 * Prestiti dalla cassa: un socio prende dei soldi dalla cassa "in prestito" e deve rimetterli.
 * I soldi escono subito dalla cassa, il socio vede un promemoria a ogni accesso finché non restituisce.
 */
export default function CashLoansPanel({ members, onChanged }) {
  const fieldId = useId()
  const [loans, setLoans] = useState([])
  const [form, setForm] = useState({ member_id: '', amount: '', note: '' })
  const [repay, setRepay] = useState(null)
  const [repayForm, setRepayForm] = useState({ amount: '', note: '' })
  const [message, setMessage] = useState({ type: 'success', text: '' })
  const [saving, setSaving] = useState(false)
  // Un solo codice anti-doppione per ogni tentativo di prestito (cambia solo dopo un successo).
  const loanKey = useRef(newKey())

  const load = useCallback(async () => {
    try { setLoans((await api.get('/cash-loans')).data) } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) }
  }, [])
  useEffect(() => { load() }, [load])

  async function lend(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await api.post('/cash-loans', form, { headers: { 'Idempotency-Key': loanKey.current } })
      loanKey.current = newKey()
      setMessage({ type: 'success', text: 'Prestito registrato: i soldi sono usciti dalla cassa e il socio vedrà il promemoria.' })
      setForm({ member_id: '', amount: '', note: '' })
      await load()
      onChanged?.()
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) } finally { setSaving(false) }
  }

  async function submitRepay(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await api.post(`/cash-loans/${repay.id}/repay`, repayForm)
      setMessage({ type: 'success', text: 'Restituzione registrata: i soldi sono rientrati in cassa.' })
      setRepay(null)
      await load()
      onChanged?.()
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) } finally { setSaving(false) }
  }

  async function cancel(loan) {
    const reason = window.prompt('Motivo dell\'annullamento del prestito? (i soldi tornano in cassa)')
    if (!reason || reason.trim().length < 3) return
    try {
      await api.post(`/cash-loans/${loan.id}/cancel`, { reason: reason.trim() })
      setMessage({ type: 'success', text: 'Prestito annullato: i soldi sono tornati in cassa.' })
      await load()
      onChanged?.()
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) }
  }

  const totalOpen = loans.reduce((sum, loan) => sum + Number(loan.remaining_cents || 0), 0)

  return (
    <section className="app-card stack-md mb-3" aria-labelledby={`${fieldId}-title`}>
      <div className="split">
        <div>
          <h2 className="h5 mb-1" id={`${fieldId}-title`}><HandCoins size={18} aria-hidden="true" /> Prestiti dalla cassa</h2>
          <p className="small text-muted-app mb-0">Soldi presi dalla cassa per un po': escono subito e il socio riceve un promemoria finché non li restituisce. Non sono copponi dei prodotti.</p>
        </div>
        {totalOpen > 0 && <strong className="num">{money(totalOpen)}</strong>}
      </div>
      <AlertMessage type={message.type}>{message.text}</AlertMessage>

      {loans.length > 0 ? <ul className="row-list">{loans.map((loan) => (
        <li key={loan.id}>
          <span className="cluster min-0">
            <UserAvatar name={loan.member?.name} size="sm" />
            <span className="min-0">
              <strong>{loan.member?.name} · {money(loan.remaining_cents)}</strong>
              <small>{Number(loan.repaid_cents) > 0 ? `${money(loan.repaid_cents)} già restituiti di ${money(loan.amount_cents)} · ` : ''}dal {dateTime(loan.borrowed_at)}{loan.note ? ` · ${loan.note}` : ''}</small>
            </span>
          </span>
          <span className="cluster flex-nowrap">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => { setRepay(loan); setRepayForm({ amount: centsToInput(loan.remaining_cents), note: '' }) }}>Restituito</button>
            {Number(loan.repaid_cents) === 0 && <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => cancel(loan)}>Annulla</button>}
          </span>
        </li>
      ))}</ul> : <p className="text-muted-app mb-0">Nessun prestito da restituire.</p>}

      <form className="manual-debt-form" onSubmit={lend}>
        <h3 className="h6 mb-0">Nuovo prestito</h3>
        <FormField label="Chi li prende" htmlFor={`${fieldId}-m`}>
          <select id={`${fieldId}-m`} className="form-select" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })} required>
            <option value="">Scegli socio</option>
            {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
        </FormField>
        <FormField label="Importo" htmlFor={`${fieldId}-a`}>
          <input id={`${fieldId}-a`} className="form-control" type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </FormField>
        <FormField label="Nota (facoltativa)" htmlFor={`${fieldId}-n`}>
          <input id={`${fieldId}-n`} className="form-control" maxLength={255} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Es. ha preso 20 € per il resto" />
        </FormField>
        <button className="btn btn-outline-primary" disabled={saving || !form.member_id || !form.amount}>{saving ? 'Attendi…' : 'Togli dalla cassa'}</button>
      </form>

      {repay && <AppModal title="Restituzione" subtitle={`${repay.member?.name} · da restituire ${money(repay.remaining_cents)}`} onClose={() => !saving && setRepay(null)} labelledBy={`${fieldId}-repay`}>
        <form className="stack-md" onSubmit={submitRepay}>
          <FormField label="Importo restituito" htmlFor={`${fieldId}-ra`} help="Se ne rimette solo una parte, il resto resta da restituire.">
            <input id={`${fieldId}-ra`} className="form-control form-control-lg" type="number" step="0.01" min="0.01" max={centsToInput(repay.remaining_cents)} value={repayForm.amount} onChange={(e) => setRepayForm({ ...repayForm, amount: e.target.value })} required />
          </FormField>
          <div className="summary-box">I soldi rientrano in cassa.</div>
          <button className="btn btn-primary btn-lg" disabled={saving || !repayForm.amount}>{saving ? 'Attendi…' : 'Conferma restituzione'}</button>
        </form>
      </AppModal>}
    </section>
  )
}
