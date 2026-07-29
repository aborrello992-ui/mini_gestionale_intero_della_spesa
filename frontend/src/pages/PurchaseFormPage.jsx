import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { errorMessage } from '../utils/format'

export default function PurchaseFormPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({ purchased_at: new Date().toISOString().slice(0, 10), supplier: '', receipt_number: '', note: '', items: [{ product_id: '', quantity: 1, unit_cost: 1 }] })
  useEffect(() => { api.get('/products?per_page=100').then(({ data }) => setProducts(data.data)) }, [])

  const setItem = (index, field, value) => setForm({ ...form, items: form.items.map((item, i) => i === index ? { ...item, [field]: value } : item) })
  async function submit(event) {
    event.preventDefault()
    setError('')
    try { await api.post('/purchases', form); navigate('/purchases') } catch (err) { setError(errorMessage(err)) }
  }

  return (
    <section>
      <div className="page-title"><h1>Nuovo acquisto</h1></div>
      <AlertMessage>{error}</AlertMessage>
      <form className="app-card" onSubmit={submit}>
        <div className="form-grid">
          <input className="form-control" type="date" value={form.purchased_at} onChange={(e) => setForm({ ...form, purchased_at: e.target.value })} />
          <input className="form-control" placeholder="Fornitore" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
          <input className="form-control" placeholder="Numero scontrino" value={form.receipt_number} onChange={(e) => setForm({ ...form, receipt_number: e.target.value })} />
        </div>
        <hr />
        {form.items.map((item, index) => (
          <div className="purchase-row" key={index}>
            <select className="form-select" value={item.product_id} onChange={(e) => setItem(index, 'product_id', e.target.value)} required>
              <option value="">Prodotto</option>{products.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}
            </select>
            <input className="form-control" type="number" step="0.001" min="0.001" value={item.quantity} onChange={(e) => setItem(index, 'quantity', e.target.value)} />
            <input className="form-control" type="number" step="0.01" min="0" value={item.unit_cost} onChange={(e) => setItem(index, 'unit_cost', e.target.value)} />
          </div>
        ))}
        <button type="button" className="btn btn-outline-secondary mb-3" onClick={() => setForm({ ...form, items: [...form.items, { product_id: '', quantity: 1, unit_cost: 1 }] })}>Aggiungi riga</button>
        <textarea className="form-control mb-3" placeholder="Nota" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button className="btn btn-primary btn-lg">Registra acquisto</button>
      </form>
    </section>
  )
}
