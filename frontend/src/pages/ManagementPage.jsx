import { useEffect, useState } from 'react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { errorMessage } from '../utils/format'

export default function ManagementPage() {
  const [products, setProducts] = useState([])
  const [members, setMembers] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    type: 'spesa_locale',
    direction: 'uscita',
    amount: '',
    description: '',
    category: '',
    movement_date: new Date().toISOString().slice(0, 10),
    movement_time: new Date().toTimeString().slice(0, 5),
    member_id: '',
    product_id: '',
    quantity_purchased: '',
    new_selling_price: '',
    new_purchase_cost: '',
    note: '',
  })

  useEffect(() => { Promise.all([api.get('/products?per_page=100'), api.get('/members')]).then(([p, m]) => { setProducts(p.data.data); setMembers(m.data) }) }, [])

  async function submit(event) {
    event.preventDefault()
    setMessage('')
    try {
      await api.post('/management/movements', { ...form, member_id: form.member_id || null, product_id: form.product_id || null })
      setMessage('Movimento registrato.')
    } catch (err) { setMessage(errorMessage(err)) }
  }

  return (
    <section>
      <div className="page-title"><h1>Gestione</h1></div>
      <AlertMessage type={message === 'Movimento registrato.' ? 'success' : 'danger'}>{message}</AlertMessage>
      <form className="app-card form-grid" onSubmit={submit}>
        <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{['acquisto_prodotti', 'spesa_locale', 'accredito', 'quota', 'rimborso', 'pagamento_debito', 'correzione', 'altro'].map((t) => <option key={t}>{t}</option>)}</select>
        <select className="form-select" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}><option>entrata</option><option>uscita</option></select>
        <input className="form-control" type="number" step="0.01" placeholder="Importo" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <input className="form-control" placeholder="Descrizione" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input className="form-control" placeholder="Categoria" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <input className="form-control" type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} />
        <input className="form-control" type="time" value={form.movement_time} onChange={(e) => setForm({ ...form, movement_time: e.target.value })} />
        <select className="form-select" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}><option value="">Membro collegato</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
        <select className="form-select" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}><option value="">Prodotto collegato</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <input className="form-control" type="number" step="0.001" placeholder="Quantità acquistata" value={form.quantity_purchased} onChange={(e) => setForm({ ...form, quantity_purchased: e.target.value })} />
        <input className="form-control" type="number" step="0.01" placeholder="Nuovo prezzo vendita" value={form.new_selling_price} onChange={(e) => setForm({ ...form, new_selling_price: e.target.value })} />
        <input className="form-control" type="number" step="0.01" placeholder="Nuovo costo acquisto" value={form.new_purchase_cost} onChange={(e) => setForm({ ...form, new_purchase_cost: e.target.value })} />
        <textarea className="form-control" placeholder="Nota" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button className="btn btn-primary btn-lg">Salva movimento</button>
      </form>
    </section>
  )
}
