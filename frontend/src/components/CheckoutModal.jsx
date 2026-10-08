import { useId, useMemo, useState } from 'react'
import { Minus, Plus, Trash2, UserPlus, Users } from 'lucide-react'
import api from '../api/client'
import AppModal from './ui/AppModal'
import AlertMessage from './AlertMessage'
import { errorMessage, money, quantity as formatQuantity } from '../utils/format'
import { useAuth } from '../hooks/useAuth'
import { useWaitScene } from '../hooks/useWaitScene'

const MAX_PEOPLE = 6
const emptyPerson = () => ({ member_id: '', pin: '', payment_status: 'coppone' })

/** Divide i centesimi in parti uguali; i centesimi avanzati vanno ai primi (come fa il server). */
function splitCents(total, count) {
  const base = Math.floor(total / count)
  return Array.from({ length: count }, (_, index) => base + (index < total % count ? 1 : 0))
}

/**
 * Acquisto di prodotti e/o combo, da soli o divisi fra più soci.
 * Ogni persona sceglie il proprio nome, inserisce il PIN e decide se paga subito o va a coppone.
 */
export default function CheckoutModal({ members, products, combos, initialLines = [], initialPeople = 2, onClose, onDone }) {
  const fieldId = useId()
  const { user, isPersonal, isGuest } = useAuth()
  const [lines, setLines] = useState(initialLines)
  const { run: runWithScene, scene: waitScene } = useWaitScene()
  // Chi è entrato con il proprio PIN è già la prima persona: non lo ridigita.
  const [people, setPeople] = useState(() => {
    const others = Array.from({ length: Math.max(0, initialPeople - (isPersonal ? 1 : 0)) }, emptyPerson)
    return isPersonal ? [{ member_id: String(user.id), pin: '', payment_status: isGuest ? 'paid' : 'coppone', self: true }, ...others] : others.length ? others : [emptyPerson()]
  })
  const [picker, setPicker] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const comboById = useMemo(() => new Map(combos.map((combo) => [combo.id, combo])), [combos])

  const detailed = lines.map((line) => {
    if (line.combo_id) {
      const combo = comboById.get(line.combo_id)
      return { ...line, name: combo?.name || 'Combo', unitCents: combo?.price_cents || 0, listCents: combo?.list_price_cents || 0, available: combo?.available_count ?? 0, step: 1 }
    }
    const product = productById.get(line.product_id)
    return { ...line, name: product?.name || 'Prodotto', unitCents: Number(product?.selling_price_cents || 0), available: Number(product?.current_quantity || 0), unit: product?.unit, step: 1 }
  })
  const total = detailed.reduce((sum, line) => sum + Math.round(line.unitCents * line.quantity), 0)
  const shares = splitCents(total, people.length)
  const chosen = new Set(people.map((person) => String(person.member_id)).filter(Boolean))
  const overStock = detailed.find((line) => line.quantity > line.available)
  const isGuestMember = (memberId) => members.find((member) => String(member.id) === String(memberId))?.role === 'guest' || (isGuest && String(memberId) === String(user?.id))
  const ready = lines.length > 0 && people.every((person) => person.member_id && (person.self || /^\d{3}$/.test(person.pin))) && !overStock

  function addLine(value) {
    setPicker('')
    if (!value) return
    const [kind, rawId] = value.split(':')
    const id = Number(rawId)
    const key = kind === 'c' ? 'combo_id' : 'product_id'
    setLines((current) => current.some((line) => line[key] === id)
      ? current.map((line) => (line[key] === id ? { ...line, quantity: line.quantity + 1 } : line))
      : [...current, { [key]: id, quantity: 1 }])
  }

  function changeQuantity(index, delta) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, quantity: Math.max(1, line.quantity + delta) } : line)))
  }

  function updatePerson(index, patch) {
    setPeople((current) => current.map((person, i) => (i === index ? { ...person, ...patch } : person)))
  }

  async function submit(event) {
    event.preventDefault()
    if (!ready || saving) return
    setSaving(true)
    setError('')
    try {
      const kind = people.some((person) => person.payment_status === 'coppone' && !isGuestMember(person.member_id)) ? 'coppone' : 'pay'
      const first = members.find((member) => String(member.id) === String(people[0]?.member_id)) || user
      const { data } = await runWithScene(kind, isPersonal ? user : first, (idempotencyKey) => api.post('/sales', {
        items: lines.map((line) => (line.combo_id ? { combo_id: line.combo_id, quantity: line.quantity } : { product_id: line.product_id, quantity: line.quantity })),
        participants: people.map((person) => ({ member_id: Number(person.member_id), ...(person.self ? {} : { pin: person.pin }), payment_status: isGuestMember(person.member_id) ? 'paid' : person.payment_status })),
      }, { headers: { 'Idempotency-Key': idempotencyKey } }))
      onDone?.(data)
    } catch (err) {
      setError(errorMessage(err))
      // I PIN non restano scritti dopo un errore.
      setPeople((current) => current.map((person) => ({ ...person, pin: '' })))
    } finally { setSaving(false) }
  }

  const title = people.length > 1 ? 'Mangia con un amico' : 'Prendi'

  return (
    <AppModal title={title} subtitle={people.length > 1 ? `Il conto si divide in ${people.length}. Ognuno conferma con il suo PIN.` : 'Conferma con il tuo PIN.'} onClose={() => !saving && onClose()} labelledBy={`${fieldId}-title`}>
      <form className="stack-md" onSubmit={submit}>
        <AlertMessage>{error}</AlertMessage>

        <section className="stack-sm" aria-labelledby={`${fieldId}-what`}>
          <h3 className="section-title mb-0" id={`${fieldId}-what`}>Cosa prendete</h3>
          {detailed.length ? <ul className="row-list">{detailed.map((line, index) => (
            <li key={line.combo_id ? `c${line.combo_id}` : `p${line.product_id}`}>
              <span className="min-0">
                <strong className="text-break">{line.combo_id ? '★ ' : ''}{line.name}</strong>
                <small>{money(line.unitCents)}{line.listCents > line.unitCents ? <> invece di <s>{money(line.listCents)}</s></> : null} · disponibili {line.combo_id ? line.available : formatQuantity(line.available, line.unit)}</small>
                {line.quantity > line.available && <small className="text-danger fw-bold">Non ce ne sono abbastanza.</small>}
              </span>
              <span className="cluster flex-nowrap">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => (line.quantity > 1 ? changeQuantity(index, -1) : setLines(lines.filter((_, i) => i !== index)))} aria-label={line.quantity > 1 ? `Uno in meno di ${line.name}` : `Togli ${line.name}`}>{line.quantity > 1 ? <Minus size={15} /> : <Trash2 size={15} />}</button>
                <strong className="num" aria-live="polite">{line.quantity}</strong>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => changeQuantity(index, 1)} aria-label={`Uno in più di ${line.name}`}><Plus size={15} /></button>
              </span>
            </li>
          ))}</ul> : <p className="text-muted-app mb-0">Aggiungi un prodotto o una combo.</p>}
          <label className="visually-hidden" htmlFor={`${fieldId}-add`}>Aggiungi prodotto o combo</label>
          <select id={`${fieldId}-add`} className="form-select" value={picker} onChange={(e) => addLine(e.target.value)}>
            <option value="">+ Aggiungi prodotto, bevanda o combo…</option>
            {combos.length > 0 && <optgroup label="Combo">{combos.filter((combo) => combo.available_count > 0).map((combo) => <option key={combo.id} value={`c:${combo.id}`}>{combo.name} · {money(combo.price_cents)}</option>)}</optgroup>}
            <optgroup label="Prodotti e bevande">{products.filter((product) => Number(product.current_quantity) > 0).map((product) => <option key={product.id} value={`p:${product.id}`}>{product.name} · {money(product.selling_price_cents)}</option>)}</optgroup>
          </select>
        </section>

        <section className="stack-sm" aria-labelledby={`${fieldId}-who`}>
          <h3 className="section-title mb-0" id={`${fieldId}-who`}><Users size={18} aria-hidden="true" /> Chi paga</h3>
          {people.map((person, index) => (
            <fieldset className="checkout-person" key={index}>
              <legend className="visually-hidden">Persona {index + 1}</legend>
              <div className="split">
                <span className="player-tag">{index + 1}P</span>
                <strong className="num">{money(shares[index] || 0)}</strong>
                {people.length > 1 && !person.self && <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => setPeople(people.filter((_, i) => i !== index))} aria-label={`Togli persona ${index + 1}`}><Trash2 size={15} /></button>}
              </div>
              {person.self
                ? <div className="small">Sei tu: <strong>{user.name}</strong> · nessun PIN da inserire</div>
                : <>
              <div className="restock-two">
                <div>
                  <label className="form-label" htmlFor={`${fieldId}-m${index}`}>Nome</label>
                  <select id={`${fieldId}-m${index}`} className="form-select" value={person.member_id} onChange={(e) => updatePerson(index, { member_id: e.target.value })} required>
                    <option value="">Chi sei?</option>
                    {members.filter((member) => String(member.id) === String(person.member_id) || !chosen.has(String(member.id))).map((member) => <option key={member.id} value={member.id}>{member.name}{member.role === 'guest' ? ' (ospite)' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label" htmlFor={`${fieldId}-p${index}`}>PIN</label>
                  <input id={`${fieldId}-p${index}`} className="form-control pin-input" type="password" inputMode="numeric" autoComplete="off" maxLength="3" value={person.pin} onChange={(e) => updatePerson(index, { pin: e.target.value.replace(/\D/g, '').slice(0, 3) })} required />
                </div>
              </div>
                </>}
              <div className="segmented" role="group" aria-label={`Pagamento persona ${index + 1}`}>
                <button type="button" className={`btn ${person.payment_status === 'paid' || isGuestMember(person.member_id) ? 'btn-success' : 'btn-outline-secondary'}`} aria-pressed={person.payment_status === 'paid' || isGuestMember(person.member_id)} onClick={() => updatePerson(index, { payment_status: 'paid' })}>{isGuestMember(person.member_id) ? 'Da verificare (ospite)' : 'Pagato'}</button>
                {!isGuestMember(person.member_id) && <button type="button" className={`btn ${person.payment_status === 'coppone' ? 'btn-warning' : 'btn-outline-secondary'}`} aria-pressed={person.payment_status === 'coppone'} onClick={() => updatePerson(index, { payment_status: 'coppone' })}>Coppone</button>}
              </div>
            </fieldset>
          ))}
          {people.length < MAX_PEOPLE && <button type="button" className="btn btn-outline-primary" onClick={() => setPeople([...people, emptyPerson()])}><UserPlus size={17} /> Aggiungi una persona</button>}
        </section>

        {people.some((person) => isGuestMember(person.member_id)) && <p className="small text-muted-app mb-0">Gli ospiti mettono i soldi in cassa: il primo socio al tavolo fa da garante finché un amministratore non verifica il pagamento.</p>}
        <div className="summary-box split">
          <span>Totale{people.length > 1 ? ` · ${money(shares[0] || 0)} a testa circa` : ''}</span>
          <strong className="h4 mb-0 num">{money(total)}</strong>
        </div>
        {waitScene}
        <button className="btn btn-primary btn-lg" disabled={!ready || saving}>{saving ? 'Registrazione…' : people.filter((person) => !person.self).length ? `Conferma (${people.filter((person) => !person.self).length} PIN)` : 'Conferma'}</button>
      </form>
    </AppModal>
  )
}
