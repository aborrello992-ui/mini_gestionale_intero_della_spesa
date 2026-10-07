import { useCallback, useEffect, useId, useState } from 'react'
import { ArrowRightLeft, Plus } from 'lucide-react'
import api from '../api/client'
import AlertMessage from './AlertMessage'
import AppModal from './ui/AppModal'
import FormField from './forms/FormField'
import StatusBadge from './ui/StatusBadge'
import { dateTime, errorMessage, localDate, localTime, money, quantity } from '../utils/format'

const activeDebt = (withdrawal) => (withdrawal.debts || []).find((debt) => ['open', 'settled'].includes(debt.status))

function effectPreview(withdrawal, newMember) {
  const from = withdrawal.member?.name || 'socio attuale'
  const to = newMember?.name || 'nuovo socio'
  const total = Number(withdrawal.total_amount_cents || 0)
  if (withdrawal.payment_status === 'paid') {
    return [`Il prelievo pagato passa da ${from} a ${to}.`, 'La cassa non cambia.']
  }
  const debt = activeDebt(withdrawal)
  const paid = Number(debt?.paid_amount_cents || 0)
  const lines = [`Il debito di ${from} diminuisce di ${money(total)}, quello di ${to} aumenta di ${money(total)}.`]
  if (paid > 0) lines.push(`${from} aveva già pagato ${money(paid)}: gli tornano come credito (usato subito per eventuali altri copponi).`)
  lines.push('La cassa non cambia.')
  return lines
}

export default function WithdrawalReassignPanel({ members, onChanged }) {
  const fieldId = useId()
  const [rows, setRows] = useState([])
  const [products, setProducts] = useState([])
  const [filters, setFilters] = useState({ member_id: '', product_id: '', date_from: '', date_to: '' })
  const [message, setMessage] = useState({ type: 'success', text: '' })
  const [reassign, setReassign] = useState(null)
  const [reassignForm, setReassignForm] = useState({ member_id: '', reason: '' })
  const [manualOpen, setManualOpen] = useState(false)
  const emptyManual = () => ({ member_id: '', product_id: '', quantity: '1', payment_status: 'coppone', withdrawn_date: localDate(), withdrawn_time: localTime(), affects_stock: true, notes: '' })
  const [manual, setManual] = useState(emptyManual)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const params = new URLSearchParams({ per_page: '50' })
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value) })
    try {
      setRows((await api.get(`/withdrawals?${params}`)).data.data)
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) }
  }, [filters])

  useEffect(() => { load() }, [load])
  useEffect(() => { api.get('/products?per_page=500').then(({ data }) => setProducts(data.data)).catch(() => {}) }, [])

  async function submitReassign(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await api.post(`/withdrawals/${reassign.id}/reassign`, reassignForm)
      setMessage({ type: 'success', text: 'Prelievo riassegnato.' })
      setReassign(null)
      load()
      onChanged?.()
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) } finally { setSaving(false) }
  }

  async function submitManual(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await api.post('/withdrawals/manual', manual)
      setMessage({ type: 'success', text: 'Prelievo dimenticato registrato.' })
      setManualOpen(false)
      setManual(emptyManual())
      load()
      onChanged?.()
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) } finally { setSaving(false) }
  }

  const selectedMember = members.find((member) => String(member.id) === String(reassignForm.member_id))
  const manualProduct = products.find((product) => String(product.id) === String(manual.product_id))

  return (
    <div className="stack-md">
      <AlertMessage type={message.type}>{message.text}</AlertMessage>
      <div className="app-card filter-bar">
        <FormField label="Socio" htmlFor={`${fieldId}-fm`}><select id={`${fieldId}-fm`} className="form-select" value={filters.member_id} onChange={(e) => setFilters({ ...filters, member_id: e.target.value })}><option value="">Tutti</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></FormField>
        <FormField label="Prodotto" htmlFor={`${fieldId}-fp`}><select id={`${fieldId}-fp`} className="form-select" value={filters.product_id} onChange={(e) => setFilters({ ...filters, product_id: e.target.value })}><option value="">Tutti</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FormField>
        <FormField label="Dal" htmlFor={`${fieldId}-ff`}><input id={`${fieldId}-ff`} className="form-control" type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} /></FormField>
        <FormField label="Al" htmlFor={`${fieldId}-ft`}><input id={`${fieldId}-ft`} className="form-control" type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} /></FormField>
      </div>
      <button type="button" className="btn btn-outline-primary btn-lg" onClick={() => setManualOpen(true)}><Plus size={18} /> Aggiungi prelievo dimenticato</button>

      {rows.length ? <div className="stack-sm">{rows.map((row) => (
        <div className="app-card stack-sm" key={row.id}>
          <div className="split align-items-start">
            <div className="min-0">
              <strong className="text-break">{row.product?.name}</strong> · {quantity(row.quantity, row.product?.unit)}
              <div className="small text-muted-app">{row.member?.name} · {dateTime(row.withdrawn_at)}</div>
              {row.reassigned_at && <div className="small text-muted-app">Riassegnato da {row.original_member?.name || '-'}: {row.reassign_reason}</div>}
            </div>
            <div className="text-end">
              <strong className="num d-block">{money(row.total_amount_cents)}</strong>
              <StatusBadge status={row.payment_status} />
            </div>
          </div>
          <div className="cluster">
            {row.is_manual && <StatusBadge tone="info">Inserito a mano</StatusBadge>}
            {row.status !== 'active' && <StatusBadge status="annullato" />}
          </div>
          {row.status === 'active' && <button type="button" className="btn btn-outline-primary" onClick={() => { setReassign(row); setReassignForm({ member_id: '', reason: '' }) }}><ArrowRightLeft size={17} /> Riassegna</button>}
        </div>
      ))}</div> : <p className="text-muted-app">Nessun prelievo con questi filtri.</p>}

      {reassign && <AppModal title="Riassegna prelievo" subtitle={`${reassign.product?.name} · ${money(reassign.total_amount_cents)} · ${reassign.member?.name}`} onClose={() => !saving && setReassign(null)} labelledBy="reassign-title">
        <form className="stack-md" onSubmit={submitReassign}>
          <FormField label="Nuovo socio" htmlFor={`${fieldId}-rm`}><select id={`${fieldId}-rm`} className="form-select form-select-lg" value={reassignForm.member_id} onChange={(e) => setReassignForm({ ...reassignForm, member_id: e.target.value })} required><option value="">Scegli socio</option>{members.filter((m) => m.id !== reassign.user_id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></FormField>
          <FormField label="Motivo" htmlFor={`${fieldId}-rr`}><input id={`${fieldId}-rr`} className="form-control" minLength={3} maxLength={255} value={reassignForm.reason} onChange={(e) => setReassignForm({ ...reassignForm, reason: e.target.value })} required placeholder="Es. preso per errore col nome sbagliato" /></FormField>
          {selectedMember && <div className="summary-box stack-sm" aria-live="polite">{effectPreview(reassign, selectedMember).map((line) => <div key={line}>{line}</div>)}</div>}
          <button className="btn btn-primary btn-lg" disabled={saving || !reassignForm.member_id || reassignForm.reason.trim().length < 3}>{saving ? 'Attendi…' : 'Conferma riassegnazione'}</button>
        </form>
      </AppModal>}

      {manualOpen && <AppModal title="Prelievo dimenticato" subtitle="Registra un prodotto preso e non segnato." onClose={() => !saving && setManualOpen(false)} labelledBy="manual-title">
        <form className="stack-md" onSubmit={submitManual}>
          <FormField label="Socio" htmlFor={`${fieldId}-mm`}><select id={`${fieldId}-mm`} className="form-select" value={manual.member_id} onChange={(e) => setManual({ ...manual, member_id: e.target.value })} required><option value="">Scegli socio</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></FormField>
          <FormField label="Prodotto" htmlFor={`${fieldId}-mp`}><select id={`${fieldId}-mp`} className="form-select" value={manual.product_id} onChange={(e) => setManual({ ...manual, product_id: e.target.value })} required><option value="">Scegli prodotto</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name} ({quantity(p.current_quantity, p.unit)})</option>)}</select></FormField>
          <FormField label="Quantità" htmlFor={`${fieldId}-mq`}><input id={`${fieldId}-mq`} className="form-control" inputMode="decimal" value={manual.quantity} onChange={(e) => setManual({ ...manual, quantity: e.target.value })} required /></FormField>
          <fieldset>
            <legend className="form-label">Pagamento</legend>
            <div className="choice-grid">
              <button type="button" className={`btn btn-lg ${manual.payment_status === 'paid' ? 'btn-success' : 'btn-outline-success'}`} aria-pressed={manual.payment_status === 'paid'} onClick={() => setManual({ ...manual, payment_status: 'paid' })}>Pagato</button>
              <button type="button" className={`btn btn-lg ${manual.payment_status === 'coppone' ? 'btn-warning' : 'btn-outline-warning'}`} aria-pressed={manual.payment_status === 'coppone'} onClick={() => setManual({ ...manual, payment_status: 'coppone' })}>Coppone</button>
            </div>
          </fieldset>
          <div className="form-grid">
            <FormField label="Data" htmlFor={`${fieldId}-md`}><input id={`${fieldId}-md`} className="form-control" type="date" max={localDate()} value={manual.withdrawn_date} onChange={(e) => setManual({ ...manual, withdrawn_date: e.target.value })} required /></FormField>
            <FormField label="Ora" htmlFor={`${fieldId}-mt`}><input id={`${fieldId}-mt`} className="form-control" type="time" value={manual.withdrawn_time} onChange={(e) => setManual({ ...manual, withdrawn_time: e.target.value })} required /></FormField>
          </div>
          <div className="form-check">
            <input id={`${fieldId}-ms`} className="form-check-input" type="checkbox" checked={!manual.affects_stock} onChange={(e) => setManual({ ...manual, affects_stock: !e.target.checked })} />
            <label className="form-check-label" htmlFor={`${fieldId}-ms`}>Non toccare il magazzino (la quantità era già stata scalata)</label>
          </div>
          <FormField label="Nota" htmlFor={`${fieldId}-mn`}><input id={`${fieldId}-mn`} className="form-control" maxLength={500} value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} /></FormField>
          {manualProduct && <div className="summary-box split"><span>Importo</span><strong className="num">{money(Math.round(Number(String(manual.quantity).replace(',', '.')) * Number(manualProduct.selling_price_cents || 0)) || 0)}</strong></div>}
          <button className="btn btn-primary btn-lg" disabled={saving}>{saving ? 'Attendi…' : 'Registra prelievo'}</button>
        </form>
      </AppModal>}
    </div>
  )
}
