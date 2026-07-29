import { useEffect, useState } from 'react'
import api from '../api/client'
import ProductCard from '../components/ProductCard'
import Pagination from '../components/Pagination'
import { useAuth } from '../hooks/useAuth'
import { errorMessage } from '../utils/format'
import AlertMessage from '../components/AlertMessage'

export default function ProductsPage() {
  const { isAdmin } = useAuth()
  const [products, setProducts] = useState(null)
  const [meta, setMeta] = useState(null)
  const [lookups, setLookups] = useState({ categories: [], locations: [] })
  const [form, setForm] = useState({ name: '', category_id: '', location_id: '', unit: 'pezzi', current_quantity: 0, minimum_threshold: 1 })
  const [message, setMessage] = useState('')

  async function load(page = 1) {
    const [{ data }, categories, locations] = await Promise.all([api.get(`/products?page=${page}`), api.get('/categories'), api.get('/locations')])
    setProducts(data.data); setMeta(data); setLookups({ categories: categories.data, locations: locations.data })
  }
  useEffect(() => { load() }, [])

  async function create(event) {
    event.preventDefault()
    setMessage('')
    try {
      const payload = { ...form, category_id: Number(form.category_id), location_id: Number(form.location_id) }
      const { data } = await api.post('/products', payload)
      setMessage(data.warning || 'Prodotto creato.')
      setForm({ ...form, name: '', current_quantity: 0 })
      load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  if (!products) return null
  return (
    <section>
      <div className="page-title"><h1>Prodotti</h1></div>
      <AlertMessage type={message === 'Prodotto creato.' ? 'success' : 'warning'}>{message}</AlertMessage>
      {isAdmin && <form className="app-card form-grid mb-3" onSubmit={create}>
        <input className="form-control" placeholder="Nome prodotto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <select className="form-select" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} required><option value="">Categoria</option>{lookups.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="form-select" value={form.location_id} onChange={(e) => setForm({ ...form, location_id: e.target.value })} required><option value="">Posizione</option>{lookups.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
        <select className="form-select" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{['pezzi', 'bottiglie', 'confezioni', 'chilogrammi', 'grammi', 'litri', 'millilitri'].map((u) => <option key={u}>{u}</option>)}</select>
        <input className="form-control" type="number" step="0.001" value={form.current_quantity} onChange={(e) => setForm({ ...form, current_quantity: e.target.value })} />
        <input className="form-control" type="number" step="0.001" value={form.minimum_threshold} onChange={(e) => setForm({ ...form, minimum_threshold: e.target.value })} />
        <button className="btn btn-primary">Aggiungi</button>
      </form>}
      <div className="card-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      <Pagination page={meta} onPage={load} />
    </section>
  )
}
