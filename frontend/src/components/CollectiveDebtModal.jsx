import { useId, useState } from 'react'
import api from '../api/client'
import AppModal from './ui/AppModal'
import FormField from './forms/FormField'
import { errorMessage, money, newUuid } from '../utils/format'

/**
 * Coppone collettivo: un ammanco di cassa diviso in parti uguali fra i soci scelti.
 * La cassa registra l'ammanco come uscita; ogni socio riceve un coppone con la sua parte.
 */
export default function CollectiveDebtModal({ members, onClose, onDone }) {
  const fieldId = useId()
  const partners = members.filter((member) => member.role !== 'guest')
  const [amount, setAmount] = useState('')
  const [chosen, setChosen] = useState([])
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [key] = useState(newUuid)

  const cents = Math.round((Number(String(amount).replace(',', '.')) || 0) * 100)
  const count = chosen.length
  const base = count ? Math.floor(cents / count) : 0
  const remainder = count ? cents % count : 0
  const toggle = (id) => setChosen((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const valid = cents > 0 && count > 0 && cents >= count && reason.trim().length >= 3

  async function submit(event) {
    event.preventDefault()
    if (saving || !valid) return
    setSaving(true)
    setError('')
    try {
      await api.post('/debts/collective', { amount: (cents / 100).toFixed(2), member_ids: chosen, reason }, { headers: { 'Idempotency-Key': key } })
      onDone(`Coppone collettivo di ${money(cents)} registrato e diviso fra ${count} soci.`)
    } catch (err) { setError(errorMessage(err)) } finally { setSaving(false) }
  }

  return (
    <AppModal title="Coppone collettivo" subtitle="Dividi fra i soci i soldi che mancano nel cassetto." onClose={() => !saving && onClose()} labelledBy="collective-title">
      <form className="stack-md" onSubmit={submit}>
        {error && <div className="alert alert-danger mb-0" role="alert">{error}</div>}
        <FormField label="Quanto manca in cassa" htmlFor={`${fieldId}-amount`} help="La differenza fra quello che segna l'app e i contanti che hai contato.">
          <input id={`${fieldId}-amount`} className="form-control form-control-lg" inputMode="decimal" placeholder="Es. 5,90" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
        </FormField>
        <fieldset>
          <legend className="form-label">Fra chi dividerlo</legend>
          <div className="d-flex gap-2 mb-2">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setChosen(partners.map((member) => member.id))}>Tutti</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setChosen([])}>Nessuno</button>
          </div>
          <div className="choice-grid">
            {partners.map((member) => (
              <button type="button" key={member.id} className={`btn ${chosen.includes(member.id) ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={chosen.includes(member.id)} onClick={() => toggle(member.id)}>{member.name}</button>
            ))}
          </div>
        </fieldset>
        <FormField label="Motivo" htmlFor={`${fieldId}-reason`}><input id={`${fieldId}-reason`} className="form-control" minLength={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} required placeholder="Es. ammanco conteggio contanti del 12/10" /></FormField>
        {cents > 0 && count > 0 && <div className="summary-box stack-sm" aria-live="polite">
          <div>Ognuno dei {count} soci riceve un coppone di <strong>{money(base)}</strong>{remainder ? ` (${remainder} di loro ${money(base + 1)})` : ''}.</div>
          <div>La cassa registra un ammanco di {money(cents)}: il saldo scende e torna uguale ai contanti.</div>
          <div>Chi ha un credito lo usa subito per la sua parte. Quando i soci pagano, i soldi rientrano in cassa.</div>
        </div>}
        {cents > 0 && count > 0 && cents < count && <div className="text-danger small">L'importo è troppo piccolo per dividerlo fra {count} soci.</div>}
        <button className="btn btn-warning btn-lg" disabled={saving || !valid}>{saving ? 'Attendi…' : `Crea coppone collettivo${count ? ` per ${count} soci` : ''}`}</button>
      </form>
    </AppModal>
  )
}
