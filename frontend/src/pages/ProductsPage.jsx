import { useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import ProductCard from '../components/ProductCard'
import Pagination from '../components/Pagination'
import { useAuth } from '../hooks/useAuth'
import { errorMessage, money, quantity } from '../utils/format'
import AlertMessage from '../components/AlertMessage'

export default function ProductsPage() {
  const { isAdmin } = useAuth()
  const [products, setProducts] = useState(null)
  const [members, setMembers] = useState([])
  const [meta, setMeta] = useState(null)
  const [lookups, setLookups] = useState({ categories: [], locations: [] })
  const [selected, setSelected] = useState(null)
  const [takeForm, setTakeForm] = useState({ member_id: '', pin: '', quantity: 1, notes: '' })
  const [form, setForm] = useState({ name: '', category_id: '', location_id: '', unit: 'pezzi', current_quantity: 0, minimum_threshold: 1, stock_reference_quantity: '', selling_price: '', image: null })
  const [message, setMessage] = useState('')
  const estimatedTotal = useMemo(() => selected ? Number(takeForm.quantity || 0) * Number(selected.selling_price_cents || 0) : 0, [selected, takeForm.quantity])

  async function load(page = 1) {
    const [{ data }, categories, locations, membersResponse] = await Promise.all([api.get(`/products?page=${page}`), api.get('/categories'), api.get('/locations'), api.get('/members')])
    setProducts(data.data); setMeta(data); setLookups({ categories: categories.data, locations: locations.data }); setMembers(membersResponse.data)
  }
  useEffect(() => { load() }, [])

  async function create(event) {
    event.preventDefault()
    setMessage('')
    try {
      const payload = new FormData()
      Object.entries(form).forEach(([key, value]) => {
        if (value !== null && value !== '') payload.append(key, value)
      })
      const { data } = await api.post('/products', payload, { headers: { 'Content-Type': 'multipart/form-data' } })
      setMessage(data.warning || 'Prodotto creato.')
      setForm({ ...form, name: '', current_quantity: 0, image: null })
      load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  async function take(paymentStatus) {
    setMessage('')
    try {
      const { data } = await api.post('/withdrawals', {
        product_id: selected.id,
        member_id: takeForm.member_id,
        pin: takeForm.pin,
        quantity: takeForm.quantity,
        payment_status: paymentStatus,
        notes: takeForm.notes,
      })
      setMessage(`${paymentStatus === 'paid' ? 'Pagato' : 'Coppone'} registrato: ${money(data.total_amount_cents)}.`)
      setSelected(null)
      setTakeForm({ member_id: '', pin: '', quantity: 1, notes: '' })
      load(meta?.current_page || 1)
    } catch (err) { setMessage(errorMessage(err)) }
  }

  if (!products) return null
  return (
    <section>
      <div className="page-title"><h1>Prodotti</h1></div>
      <AlertMessage type={message.includes('registrato') || message === 'Prodotto creato.' ? 'success' : 'warning'}>{message}</AlertMessage>
      {isAdmin && <form className="app-card form-grid mb-3" onSubmit={create}>
        <input className="form-control" placeholder="Nome prodotto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <select className="form-select" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required><option value="">Categoria</option>{lookups.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="form-select" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} required><option value="">Posizione</option>{lookups.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <select className="form-select" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{['pezzi', 'bottiglie', 'confezioni', 'chilogrammi', 'grammi', 'litri', 'millilitri'].map((u) => <option key={u}>{u}</option>)}</select>
        <input className="form-control" type="number" step="0.001" placeholder="Disponibilità" value={form.current_quantity} onChange={(e) => setForm({ ...form, current_quantity: e.target.value })} />
        <input className="form-control" type="number" step="0.001" placeholder="Soglia minima" value={form.minimum_threshold} onChange={(e) => setForm({ ...form, minimum_threshold: e.target.value })} />
        <input className="form-control" type="number" step="0.001" placeholder="Scorta riferimento" value={form.stock_reference_quantity} onChange={(e) => setForm({ ...form, stock_reference_quantity: e.target.value })} />
        <input className="form-control" type="number" step="0.01" placeholder="Prezzo vendita (€)" value={form.selling_price} onChange={(e) => setForm({ ...form, selling_price: e.target.value })} />
        <input className="form-control" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setForm({ ...form, image: e.target.files[0] })} />
        <button className="btn btn-primary">Aggiungi</button>
      </form>}
      <div className="card-grid">{products.map((product) => <ProductCard key={product.id} product={product} onTake={setSelected} />)}</div>
      <Pagination page={meta} onPage={load} />

      {selected && <div className="modal-backdrop-lite" role="dialog" aria-modal="true">
        <div className="take-panel">
          <button className="btn-close float-end" onClick={() => setSelected(null)} aria-label="Chiudi" />
          <div className="product-image take-image" aria-label={selected.image_alt || selected.name}>
            {selected.image_url ? <img src={selected.image_url} alt={selected.image_alt || selected.name} /> : <span>{selected.name.slice(0, 1)}</span>}
          </div>
          <h2>{selected.name}</h2>
          <p className="text-secondary mb-2">{money(selected.selling_price_cents)} cad. · disponibili {quantity(selected.current_quantity, selected.unit)}</p>
          <label className="form-label">Membro</label>
          <select className="form-select form-select-lg mb-3" value={takeForm.member_id} onChange={(e) => setTakeForm({ ...takeForm, member_id: e.target.value })}>
            <option value="">Scegli nome</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <label className="form-label">PIN personale</label>
          <input className="form-control form-control-lg mb-3 pin-input" inputMode="numeric" maxLength="3" value={takeForm.pin} onChange={(e) => setTakeForm({ ...takeForm, pin: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
          <label className="form-label">Quantità</label>
          <input className="form-control form-control-lg mb-3" type="number" min="0.001" step="0.001" value={takeForm.quantity} onChange={(e) => setTakeForm({ ...takeForm, quantity: e.target.value })} />
          <div className="available mb-3">Totale stimato: <strong>{money(estimatedTotal)}</strong></div>
          <textarea className="form-control mb-3" placeholder="Nota facoltativa" value={takeForm.notes} onChange={(e) => setTakeForm({ ...takeForm, notes: e.target.value })} />
          <div className="quick-buttons">
            <button className="btn btn-success btn-lg" onClick={() => take('paid')}>Pagato</button>
            <button className="btn btn-warning btn-lg" onClick={() => take('coppone')}>Coppone</button>
          </div>
        </div>
      </div>}
    </section>
  )
}
