import { useCallback, useEffect, useId, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import api from '../api/client'
import AlertMessage from './AlertMessage'
import AppModal from './ui/AppModal'
import FormField from './forms/FormField'
import StatusBadge from './ui/StatusBadge'
import { centsToInput, errorMessage, money, toCents } from '../utils/format'

const DISCOUNTS = [10, 20, 30]
const emptyForm = { id: null, name: '', description: '', price: '', is_active: true, items: [] }

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
  const listPrice = form ? form.items.reduce((sum, item) => sum + Math.round(Number(item.quantity || 0) * Number(productById.get(Number(item.product_id))?.selling_price_cents || 0)), 0) : 0
  const priceCents = form ? toCents(form.price) : 0

  function edit(combo) {
    setForm(combo
      ? { id: combo.id, name: combo.name, description: combo.description || '', price: centsToInput(combo.price_cents), is_active: combo.is_active, items: combo.items.map((item) => ({ product_id: String(item.product_id), quantity: String(Number(item.quantity)) })) }
      : { ...emptyForm, items: [{ product_id: '', quantity: '1' }, { product_id: '', quantity: '1' }] })
  }

  function updateItem(index, patch) {
    setForm({ ...form, items: form.items.map((item, i) => (i === index ? { ...item, ...patch } : item)) })
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
      items: form.items.filter((item) => item.product_id).map((item) => ({ product_id: Number(item.product_id), quantity: item.quantity })),
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
          <p className="combo-items">{combo.items.map((item) => `${Number(item.quantity)}× ${item.product?.name}`).join(' + ')}</p>
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
            <legend className="form-label">Prodotti</legend>
            {form.items.map((item, index) => (
              <div className="combo-item-row" key={index}>
                <label className="visually-hidden" htmlFor={`${fieldId}-p${index}`}>Prodotto {index + 1}</label>
                <select id={`${fieldId}-p${index}`} className="form-select" value={item.product_id} onChange={(e) => updateItem(index, { product_id: e.target.value })}>
                  <option value="">Scegli prodotto</option>
                  {products.map((product) => <option key={product.id} value={product.id} disabled={form.items.some((other, i) => i !== index && other.product_id === String(product.id))}>{product.name} · {money(product.selling_price_cents)}</option>)}
                </select>
                <label className="visually-hidden" htmlFor={`${fieldId}-q${index}`}>Quantità prodotto {index + 1}</label>
                <input id={`${fieldId}-q${index}`} className="form-control text-center" inputMode="decimal" value={item.quantity} onChange={(e) => updateItem(index, { quantity: e.target.value })} />
                <button type="button" className="btn btn-outline-secondary" onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== index) })} aria-label={`Togli prodotto ${index + 1}`}><Trash2 size={16} /></button>
              </div>
            ))}
            {form.items.length < 10 && <button type="button" className="btn btn-outline-primary" onClick={() => setForm({ ...form, items: [...form.items, { product_id: '', quantity: '1' }] })}><Plus size={16} /> Aggiungi prodotto</button>}
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
