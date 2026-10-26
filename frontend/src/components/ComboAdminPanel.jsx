import { useCallback, useEffect, useId, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import api from '../api/client'
import AlertMessage from './AlertMessage'
import AppModal from './ui/AppModal'
import FormField from './forms/FormField'
import StatusBadge from './ui/StatusBadge'
import { comboLabel, comboSlots } from '../utils/comboItems'
import { centsToInput, errorMessage, money, toCents } from '../utils/format'

const DISCOUNTS = [10, 20, 30]
const emptyForm = { id: null, name: '', description: '', price: '', is_active: true, slots: [] }
// Un posto della combo: un prodotto fisso, oppure una scelta fra più prodotti (chi la prende ne sceglie uno).
const fixedSlot = () => ({ kind: 'fixed', product_id: '', quantity: '1' })
const choiceSlot = () => ({ kind: 'choice', quantity: '1', product_ids: ['', ''] })

export default function ComboAdminPanel() {
  const fieldId = useId()
  const [combos, setCombos] = useState([])
  const [products, setProducts] = useState([])
  const [form, setForm] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [message, setMessage] = useState({ type: 'success', text: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const [comboResponse, productResponse] = await Promise.all([api.get('/combos?include_inactive=1'), api.get('/products?per_page=500')])
      setCombos(comboResponse.data)
      setProducts(productResponse.data.data)
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) }
  }, [])
  useEffect(() => { load() }, [load])

  const productById = new Map(products.map((product) => [product.id, product]))
  const priceOf = (productId) => Number(productById.get(Number(productId))?.selling_price_cents || 0)
  const listPrice = form ? form.slots.reduce((sum, slot) => {
    const id = slot.kind === 'fixed' ? slot.product_id : slot.product_ids.find(Boolean)
    return sum + Math.round(Number(slot.quantity || 0) * priceOf(id))
  }, 0) : 0
  const priceCents = form ? toCents(form.price) : 0
  const usedIds = form ? form.slots.flatMap((slot) => (slot.kind === 'fixed' ? [slot.product_id] : slot.product_ids)).filter(Boolean) : []

  function edit(combo) {
    setForm(combo
      ? {
        id: combo.id, name: combo.name, description: combo.description || '', price: centsToInput(combo.price_cents), is_active: combo.is_active,
        slots: comboSlots(combo).map((slot) => (slot.group
          ? { kind: 'choice', quantity: String(slot.quantity), product_ids: slot.items.map((item) => String(item.product_id)) }
          : { kind: 'fixed', quantity: String(slot.quantity), product_id: String(slot.items[0].product_id) })),
      }
      : { ...emptyForm, slots: [fixedSlot(), choiceSlot()] })
  }

  function updateSlot(index, patch) {
    setForm({ ...form, slots: form.slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)) })
  }

  function setChoiceProduct(slotIndex, productIndex, value) {
    const slot = form.slots[slotIndex]
    updateSlot(slotIndex, { product_ids: slot.product_ids.map((id, i) => (i === productIndex ? value : id)) })
  }

  // Le scelte diventano gruppi numerati (1, 2, 3…) per il server.
  function toItems() {
    let group = 0
    return form.slots.flatMap((slot) => {
      if (slot.kind === 'fixed') return slot.product_id ? [{ product_id: Number(slot.product_id), quantity: slot.quantity, choice_group: null }] : []
      const ids = slot.product_ids.filter(Boolean)
      if (!ids.length) return []
      group += 1
      return ids.map((id) => ({ product_id: Number(id), quantity: slot.quantity, choice_group: group }))
    })
  }

  async function save(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: form.price,
      is_active: form.is_active,
      items: toItems(),
    }
    try {
      if (form.id) await api.put(`/combos/${form.id}`, payload)
      else await api.post('/combos', payload)
      setMessage({ type: 'success', text: `Combo «${payload.name}» salvata.` })
      setForm(null)
      load()
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) } finally { setSaving(false) }
  }

  async function remove() {
    try {
      const response = await api.delete(`/combos/${confirmDelete.id}`)
      setMessage({ type: 'success', text: response.data?.message || `Combo «${confirmDelete.name}» eliminata.` })
      setConfirmDelete(null)
      load()
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) }
  }

  return (
    <div className="stack-md">
      <AlertMessage type={message.type}>{message.text}</AlertMessage>
      <div className="split">
        <p className="text-muted-app mb-0">Unisci prodotti che si vendono poco a un prezzo più basso: le combo compaiono in cima alla pagina Prodotti.</p>
        <button type="button" className="btn btn-primary" onClick={() => edit(null)}><Plus size={17} /> Nuova combo</button>
      </div>

      {combos.length ? <div className="combo-grid">{combos.map((combo) => (
        <article className={`combo-card ${combo.is_active ? '' : 'is-empty'}`} key={combo.id}>
          <div className="combo-card-head"><h3>{combo.name}</h3>{!combo.is_active && <StatusBadge tone="neutral">Disattivata</StatusBadge>}</div>
          <p className="combo-items">{comboLabel(combo)}</p>
          <div className="combo-price"><strong>{money(combo.price_cents)}</strong><s>{money(combo.list_price_cents)}</s></div>
          <div className="small">Disponibili: {combo.available_count}</div>
          <div className="product-admin-actions">
            <button type="button" className="btn btn-outline-primary" onClick={() => edit(combo)}><Pencil size={16} /> Modifica</button>
            <button type="button" className="btn btn-outline-primary" onClick={() => setConfirmDelete(combo)}><Trash2 size={16} /> Elimina</button>
          </div>
        </article>
      ))}</div> : <p className="text-muted-app">Nessuna combo ancora.</p>}

      {form && <AppModal title={form.id ? 'Modifica combo' : 'Nuova combo'} subtitle={form.name || 'Prodotti venduti insieme'} onClose={() => !saving && setForm(null)} labelledBy={`${fieldId}-title`}>
        <form className="stack-md" onSubmit={save}>
          <FormField label="Nome" htmlFor={`${fieldId}-name`}><input id={`${fieldId}-name`} className="form-control" maxLength={80} placeholder="Es. Salamini + tarallini" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></FormField>
          <fieldset className="stack-sm">
            <legend className="form-label">Cosa contiene</legend>
            {form.slots.map((slot, index) => slot.kind === 'fixed' ? (
              <div className="combo-item-row" key={index}>
                <label className="visually-hidden" htmlFor={`${fieldId}-p${index}`}>Prodotto {index + 1}</label>
                <select id={`${fieldId}-p${index}`} className="form-select" value={slot.product_id} onChange={(e) => updateSlot(index, { product_id: e.target.value })}>
                  <option value="">Scegli prodotto</option>
                  {products.map((product) => <option key={product.id} value={product.id} disabled={usedIds.includes(String(product.id)) && String(product.id) !== slot.product_id}>{product.name} · {money(product.selling_price_cents)}</option>)}
                </select>
                <label className="visually-hidden" htmlFor={`${fieldId}-q${index}`}>Quantità {index + 1}</label>
                <input id={`${fieldId}-q${index}`} className="form-control text-center" inputMode="decimal" value={slot.quantity} onChange={(e) => updateSlot(index, { quantity: e.target.value })} />
                <button type="button" className="btn btn-outline-secondary" onClick={() => setForm({ ...form, slots: form.slots.filter((_, i) => i !== index) })} aria-label={`Togli prodotto ${index + 1}`}><Trash2 size={16} /></button>
              </div>
            ) : (
              <div className="combo-choice-box stack-sm" key={index}>
                <div className="split">
                  <strong>Scelta fra più prodotti</strong>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm({ ...form, slots: form.slots.filter((_, i) => i !== index) })} aria-label="Togli questa scelta"><Trash2 size={15} /></button>
                </div>
                <p className="small text-muted-app mb-0">Chi prende la combo sceglie uno di questi prodotti (es. i gusti, o le bibite allo stesso prezzo).</p>
                {slot.product_ids.map((productId, i) => (
                  <div className="combo-item-row" key={i}>
                    <label className="visually-hidden" htmlFor={`${fieldId}-c${index}-${i}`}>Alternativa {i + 1}</label>
                    <select id={`${fieldId}-c${index}-${i}`} className="form-select" value={productId} onChange={(e) => setChoiceProduct(index, i, e.target.value)}>
                      <option value="">Scegli prodotto</option>
                      {products.map((product) => <option key={product.id} value={product.id} disabled={usedIds.includes(String(product.id)) && String(product.id) !== productId}>{product.name} · {money(product.selling_price_cents)}</option>)}
                    </select>
                    <span />
                    <button type="button" className="btn btn-outline-secondary" disabled={slot.product_ids.length <= 2} onClick={() => updateSlot(index, { product_ids: slot.product_ids.filter((_, k) => k !== i) })} aria-label={`Togli alternativa ${i + 1}`}><Trash2 size={16} /></button>
                  </div>
                ))}
                <div className="split">
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => updateSlot(index, { product_ids: [...slot.product_ids, ''] })}><Plus size={15} /> Aggiungi alternativa</button>
                  <label className="cluster small">Quantità <input className="form-control form-control-sm text-center" style={{ width: 64 }} inputMode="decimal" value={slot.quantity} onChange={(e) => updateSlot(index, { quantity: e.target.value })} aria-label="Quantità della scelta" /></label>
                </div>
              </div>
            ))}
            <div className="cluster">
              {form.slots.length < 8 && <button type="button" className="btn btn-outline-primary" onClick={() => setForm({ ...form, slots: [...form.slots, fixedSlot()] })}><Plus size={16} /> Prodotto fisso</button>}
              {form.slots.filter((slot) => slot.kind === 'choice').length < 5 && <button type="button" className="btn btn-outline-primary" onClick={() => setForm({ ...form, slots: [...form.slots, choiceSlot()] })}><Plus size={16} /> Scelta fra più prodotti</button>}
            </div>
          </fieldset>
          <div className="summary-box split"><span>Comprati separati</span><strong className="num">{money(listPrice)}</strong></div>
          <FormField label="Prezzo combo" htmlFor={`${fieldId}-price`} help={priceCents && listPrice ? (priceCents < listPrice ? `Sconto di ${money(listPrice - priceCents)} (${Math.round((1 - priceCents / listPrice) * 100)}%)` : 'Il prezzo non è più basso dei prodotti separati.') : 'Scegli un prezzo più basso del totale separato.'}>
            <input id={`${fieldId}-price`} className="form-control form-control-lg" inputMode="decimal" placeholder="€" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
          </FormField>
          {listPrice > 0 && <div className="cluster">{DISCOUNTS.map((discount) => {
            const suggested = Math.max(10, Math.round((listPrice * (100 - discount)) / 1000) * 10)
            return <button type="button" key={discount} className="btn btn-sm btn-outline-secondary" onClick={() => setForm({ ...form, price: centsToInput(suggested) })}>−{discount}% · {money(suggested)}</button>
          })}</div>}
          <FormField label="Descrizione (facoltativa)" htmlFor={`${fieldId}-desc`}><input id={`${fieldId}-desc`} className="form-control" maxLength={255} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
          <div className="form-check">
            <input id={`${fieldId}-active`} className="form-check-input" type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            <label className="form-check-label" htmlFor={`${fieldId}-active`}>Combo attiva (visibile nella pagina Prodotti)</label>
          </div>
          <button className="btn btn-primary btn-lg" disabled={saving}>{saving ? 'Salvataggio…' : 'Salva combo'}</button>
        </form>
      </AppModal>}

      {confirmDelete && <AppModal title="Eliminare la combo?" subtitle={confirmDelete.name} onClose={() => setConfirmDelete(null)} labelledBy={`${fieldId}-delete`}>
        <div className="stack-md">
          <p className="mb-0">Se la combo è già stata venduta viene solo disattivata, così lo storico resta.</p>
          <div className="product-admin-actions">
            <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirmDelete(null)}>Annulla</button>
            <button type="button" className="btn btn-danger" onClick={remove} autoFocus>Elimina</button>
          </div>
        </div>
      </AppModal>}
    </div>
  )
}
