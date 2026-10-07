import { useCallback, useEffect, useId, useState } from 'react'
import { Plus, ShoppingCart } from 'lucide-react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import RestockForm from '../components/RestockForm'
import { useAuth } from '../hooks/useAuth'
import { errorMessage, money, quantity } from '../utils/format'
import PageHeader from '../components/layout/PageHeader'
import EmptyState from '../components/feedback/EmptyState'
import FormField from '../components/forms/FormField'
import StatusBadge from '../components/ui/StatusBadge'

const emptyListForm = { product_id: '', suggested_quantity: 1, priority: 'media', estimated_price: '', note: '' }

export default function ShoppingListPage() {
  const { isAdmin } = useAuth()
  const fieldId = useId()
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [message, setMessage] = useState({ type: 'success', text: '' })
  const [savingListItem, setSavingListItem] = useState(false)
  const [form, setForm] = useState(emptyListForm)

  const load = useCallback(async () => {
    try {
      const [list, productsResponse] = await Promise.all([api.get('/shopping-list?status=da_acquistare&per_page=100'), api.get('/products?per_page=500')])
      setItems(list.data.data)
      setProducts(productsResponse.data.data)
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) }
  }, [])
  useEffect(() => { load() }, [load])

  async function submit(event) {
    event.preventDefault()
    if (savingListItem) return
    setSavingListItem(true)
    setMessage({ type: 'success', text: '' })
    try {
      await api.post('/shopping-list', form)
      setMessage({ type: 'success', text: 'Voce aggiunta alla lista.' })
      setForm(emptyListForm)
      await load()
    } catch (err) { setMessage({ type: 'danger', text: errorMessage(err) }) } finally { setSavingListItem(false) }
  }

  return (
    <section>
      <PageHeader title="Lista spesa" subtitle="Cosa comprare e registrazione dello scontrino." badge={<StatusBadge tone="info">{items.length} da acquistare</StatusBadge>} />
      <AlertMessage type={message.type}>{message.text}</AlertMessage>

      {isAdmin && <RestockForm products={products} listItems={items} onSaved={load} />}

      <h2 className="h5 mt-4 mb-3">Da comprare</h2>
      <form className="app-card form-grid mb-3" onSubmit={submit}>
        <FormField label="Prodotto" htmlFor={`${fieldId}-product`}><select id={`${fieldId}-product`} className="form-select" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required><option value="">Scegli prodotto</option>{products.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></FormField>
        <FormField label="Quantità prevista" htmlFor={`${fieldId}-qty`}><input id={`${fieldId}-qty`} className="form-control" type="number" min="0.001" step="0.001" value={form.suggested_quantity} onChange={(e) => setForm({ ...form, suggested_quantity: e.target.value })} /></FormField>
        <FormField label="Priorità" htmlFor={`${fieldId}-priority`}><select id={`${fieldId}-priority`} className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>bassa</option><option>media</option><option>alta</option></select></FormField>
        <FormField label="Prezzo stimato" htmlFor={`${fieldId}-price`}><input id={`${fieldId}-price`} className="form-control" type="number" min="0" step="0.01" value={form.estimated_price} onChange={(e) => setForm({ ...form, estimated_price: e.target.value })} /></FormField>
        <button className="btn btn-primary" disabled={savingListItem}><Plus size={17} /> {savingListItem ? 'Salvataggio...' : 'Aggiungi'}</button>
      </form>

      {items.length ? <div className="card-grid mb-3">{items.map((item) => (
        <div className="app-card stack-sm" key={item.id}>
          <div className="split">
            <div className="min-0"><h3 className="h6 mb-1 text-break">{item.product?.name}</h3><div className="text-muted-app">{quantity(item.suggested_quantity, item.product?.unit)}</div></div>
            <StatusBadge tone={item.priority === 'alta' ? 'warning' : 'info'}>{item.priority}</StatusBadge>
          </div>
          {item.estimated_price_cents ? <p className="small text-muted-app mb-0">Stimato {money(item.estimated_price_cents)}</p> : null}
        </div>
      ))}</div> : <EmptyState title="La lista della spesa è vuota" message="Aggiungi un prodotto quando una scorta sta finendo." icon={ShoppingCart} />}
    </section>
  )
}
