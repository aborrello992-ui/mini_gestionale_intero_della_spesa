import { useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { errorMessage, quantity } from '../utils/format'

export default function QuickWithdrawalPage() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({ product_id: '', quantity: 1, note: '' })
  const [message, setMessage] = useState('')
  const selected = useMemo(() => products.find((p) => p.id === Number(form.product_id)), [products, form.product_id])

  useEffect(() => { api.get('/products?per_page=100').then(({ data }) => setProducts(data.data)) }, [])

  async function submit(event) {
    event.preventDefault()
    setMessage('')
    try {
      await api.post('/inventory/withdraw', form)
      setMessage('Prelievo registrato.')
      const { data } = await api.get('/products?per_page=100')
      setProducts(data.data)
    } catch (err) { setMessage(errorMessage(err)) }
  }

  return (
    <section className="narrow">
      <div className="page-title"><h1>Prelievo rapido</h1></div>
      <AlertMessage type={message === 'Prelievo registrato.' ? 'success' : 'danger'}>{message}</AlertMessage>
      <form className="app-card" onSubmit={submit}>
        <label className="form-label">Prodotto</label>
        <select className="form-select form-select-lg mb-3" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required>
          <option value="">Scegli prodotto</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {quantity(p.current_quantity, p.unit)}</option>)}
        </select>
        {selected && <div className="available">Disponibile: <strong>{quantity(selected.current_quantity, selected.unit)}</strong></div>}
        <div className="quick-buttons">
          {[1, 2].map((q) => <button type="button" className="btn btn-outline-primary btn-lg" key={q} onClick={() => setForm({ ...form, quantity: q })}>meno {q}</button>)}
        </div>
        <label className="form-label">Quantità</label>
        <input className="form-control form-control-lg mb-3" type="number" min="0.001" step="0.001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        <textarea className="form-control mb-3" placeholder="Nota facoltativa" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button className="btn btn-primary btn-lg w-100">Conferma prelievo</button>
      </form>
    </section>
  )
}
