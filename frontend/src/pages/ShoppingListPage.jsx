import { useEffect, useState } from 'react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { errorMessage, quantity } from '../utils/format'

export default function ShoppingListPage() {
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ product_id: '', suggested_quantity: 1, priority: 'media', note: '' })
  async function load() {
    const [list, productsResponse] = await Promise.all([api.get('/shopping-list?status=da_acquistare'), api.get('/products?per_page=100')])
    setItems(list.data.data); setProducts(productsResponse.data.data)
  }
  useEffect(() => { load() }, [])
  async function submit(event) {
    event.preventDefault()
    try { await api.post('/shopping-list', form); setMessage('Voce aggiornata.'); load() } catch (err) { setMessage(errorMessage(err)) }
  }
  return (
    <section>
      <div className="page-title"><h1>Lista della spesa</h1></div>
      <AlertMessage type={message === 'Voce aggiornata.' ? 'success' : 'danger'}>{message}</AlertMessage>
      <form className="app-card form-grid mb-3" onSubmit={submit}>
        <select className="form-select" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required><option value="">Prodotto</option>{products.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select>
        <input className="form-control" type="number" step="0.001" value={form.suggested_quantity} onChange={(e) => setForm({ ...form, suggested_quantity: e.target.value })} />
        <select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>bassa</option><option>media</option><option>alta</option></select>
        <input className="form-control" placeholder="Nota" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button className="btn btn-primary">Aggiungi</button>
      </form>
      <div className="card-grid">{items.map((item) => <div className="app-card" key={item.id}><h2 className="h6">{item.product?.name}</h2><p>{quantity(item.suggested_quantity, item.product?.unit)}</p><span className="badge text-bg-info">{item.priority}</span></div>)}</div>
    </section>
  )
}
