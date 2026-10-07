import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { BellRing, Lightbulb, Send, X } from 'lucide-react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import RestockForm from '../components/RestockForm'
import { useAuth } from '../hooks/useAuth'
import { errorMessage, money, quantity } from '../utils/format'
import PageHeader from '../components/layout/PageHeader'
import FormField from '../components/forms/FormField'
import StatusBadge from '../components/ui/StatusBadge'

const PRIORITIES = [['bassa', 'Bassa'], ['media', 'Media'], ['alta', 'Alta']]
const OTHER_CATEGORY = '__altro'
const emptySuggestion = { product: '', category: '', customCategory: '', suggested_quantity: '1', priority: 'media', estimated_price: '', note: '' }
const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export default function ShoppingListPage() {
  const { isAdmin } = useAuth()
  const fieldId = useId()
  const [items, setItems] = useState([])
  const [reminders, setReminders] = useState([])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [message, setMessage] = useState({ type: 'success', text: '' })
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptySuggestion)

  const load = useCallback(async () => {
    try {
      const [list, reminderResponse, productsResponse, categoriesResponse] = await Promise.all([
        api.get('/shopping-list?status=da_acquistare&per_page=200'),
        api.get('/shopping-list/reminders'),
        api.get('/products?per_page=500'),
        api.get('/categories'),
      ])
      setItems(list.data.data)
      setReminders(reminderResponse.data)
      setProducts(productsResponse.data.data)
      setCategories(categoriesResponse.data)
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) }
  }, [])
  useEffect(() => { load() }, [load])

  const matchedProduct = useMemo(() => products.find((product) => normalize(product.name) === normalize(form.product)), [products, form.product])

  async function suggest(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setMessage({ type: 'success', text: '' })
    const category = form.category === OTHER_CATEGORY ? form.customCategory.trim() : form.category
    try {
      await api.post('/shopping-list', {
        ...(matchedProduct ? { product_id: matchedProduct.id } : { suggested_name: form.product.trim(), suggested_category: category || null }),
        suggested_quantity: form.suggested_quantity,
        priority: form.priority,
        estimated_price: form.estimated_price || null,
        note: form.note || null,
      })
      setMessage({ type: 'success', text: `Grazie! «${form.product.trim()}» è nella lista della spesa.` })
      setForm(emptySuggestion)
      await load()
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) } finally { setSaving(false) }
  }

  async function dismiss(item) {
    try {
      await api.delete(`/shopping-list/${item.id}`)
      await load()
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) }
  }

  const total = items.length + reminders.length

  return (
    <section>
      <PageHeader title="Lista spesa" subtitle={isAdmin ? 'Cosa manca e registrazione dello scontrino.' : 'Cosa manca nel locale. Suggerisci quello che vorresti trovare.'} badge={<StatusBadge tone="info">{total} da comprare</StatusBadge>} />
      <AlertMessage type={message.type}>{message.text}</AlertMessage>

      <div className="card-grid mb-4">
        <div className="app-card stack-sm">
          <h2 className="section-title"><BellRing size={18} aria-hidden="true" /> Promemoria automatici</h2>
          <p className="small text-muted-app mb-0">Prodotti finiti o sotto la soglia minima: si aggiungono e si tolgono da soli.</p>
          {reminders.length ? <ul className="row-list row-list-scroll">{reminders.map((product) => (
            <li key={product.id}>
              <span className="min-0"><strong className="text-break">{product.name}</strong><small>{product.category?.name || 'Senza categoria'}</small></span>
              <StatusBadge tone={Number(product.current_quantity) <= 0 ? 'danger' : 'warning'}>{Number(product.current_quantity) <= 0 ? 'Esaurito' : `Restano ${quantity(product.current_quantity)}`}</StatusBadge>
            </li>
          ))}</ul> : <p className="text-muted-app mb-0">Nessun prodotto sotto scorta.</p>}
        </div>

        <div className="app-card stack-sm">
          <h2 className="section-title"><Lightbulb size={18} aria-hidden="true" /> Suggerimenti</h2>
          <p className="small text-muted-app mb-0">Prodotti richiesti dai soci o messi in lista dalla pagina Prodotti.</p>
          {items.length ? <ul className="row-list row-list-scroll">{items.map((item) => (
            <li key={item.id}>
              <span className="min-0">
                <strong className="text-break">{item.product?.name || item.suggested_name}</strong>
                <small>{[item.product?.category?.name || item.suggested_category, quantity(item.suggested_quantity, item.product?.unit), item.estimated_price_cents ? `stimato ${money(item.estimated_price_cents)}` : null, item.product ? null : 'nuovo'].filter(Boolean).join(' · ')}</small>
                {item.note && <small className="fst-italic">«{item.note}»</small>}
              </span>
              <span className="cluster flex-nowrap">
                <StatusBadge tone={item.priority === 'alta' ? 'danger' : item.priority === 'media' ? 'warning' : 'neutral'}>{item.priority}</StatusBadge>
                {isAdmin && <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => dismiss(item)} aria-label={`Togli ${item.product?.name || item.suggested_name} dalla lista`}><X size={15} /></button>}
              </span>
            </li>
          ))}</ul> : <p className="text-muted-app mb-0">Nessun suggerimento.</p>}
        </div>
      </div>

      {isAdmin && <RestockForm products={products} listItems={items} reminders={reminders} onSaved={load} />}

      {!isAdmin && <form className="app-card stack-md" onSubmit={suggest}>
        <h2 className="section-title mb-0"><Send size={18} aria-hidden="true" /> Suggerisci un prodotto</h2>
        <datalist id={`${fieldId}-products`}>{products.map((product) => <option key={product.id} value={product.name} />)}</datalist>
        <FormField label="Prodotto" htmlFor={`${fieldId}-product`} help={matchedProduct ? 'Prodotto già presente: verrà riordinato.' : form.product.trim() ? 'Prodotto nuovo: lo valuterà l’amministratore.' : 'Scrivi il nome: se esiste già ti viene suggerito.'}>
          <input id={`${fieldId}-product`} className="form-control form-control-lg" list={`${fieldId}-products`} autoComplete="off" maxLength={120} value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} required />
        </FormField>
        {!matchedProduct && <div className="restock-two">
          <FormField label="Categoria" htmlFor={`${fieldId}-category`}>
            <select id={`${fieldId}-category`} className="form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Non so</option>
              {categories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}
              <option value={OTHER_CATEGORY}>Altro…</option>
            </select>
          </FormField>
          {form.category === OTHER_CATEGORY && <FormField label="Nuova categoria" htmlFor={`${fieldId}-custom`}><input id={`${fieldId}-custom`} className="form-control" maxLength={80} value={form.customCategory} onChange={(e) => setForm({ ...form, customCategory: e.target.value })} required /></FormField>}
        </div>}
        <div className="restock-two">
          <FormField label="Quantità" htmlFor={`${fieldId}-qty`}><input id={`${fieldId}-qty`} className="form-control" inputMode="decimal" value={form.suggested_quantity} onChange={(e) => setForm({ ...form, suggested_quantity: e.target.value })} required /></FormField>
          <FormField label="Prezzo stimato (facoltativo)" htmlFor={`${fieldId}-price`}><input id={`${fieldId}-price`} className="form-control" inputMode="decimal" placeholder="€" value={form.estimated_price} onChange={(e) => setForm({ ...form, estimated_price: e.target.value })} /></FormField>
        </div>
        <fieldset>
          <legend className="form-label">Priorità</legend>
          <div className="segmented" role="group" aria-label="Priorità">
            {PRIORITIES.map(([value, label]) => <button type="button" key={value} className={`btn ${form.priority === value ? 'btn-primary' : 'btn-outline-secondary'}`} aria-pressed={form.priority === value} onClick={() => setForm({ ...form, priority: value })}>{label}</button>)}
          </div>
        </fieldset>
        <FormField label="Nota (facoltativa)" htmlFor={`${fieldId}-note`}><input id={`${fieldId}-note`} className="form-control" maxLength={500} placeholder="Es. marca, gusto, formato" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></FormField>
        <button className="btn btn-primary btn-lg" disabled={saving || !form.product.trim()}><Send size={18} /> {saving ? 'Invio…' : 'Aggiungi alla lista'}</button>
      </form>}
    </section>
  )
}
