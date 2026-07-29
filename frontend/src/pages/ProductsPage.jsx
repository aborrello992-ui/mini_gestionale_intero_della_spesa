import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import ProductCard from '../components/ProductCard'
import Pagination from '../components/Pagination'
import { errorMessage, money, quantity } from '../utils/format'
import AlertMessage from '../components/AlertMessage'

export default function ProductsPage() {
  const [products, setProducts] = useState(null)
  const [members, setMembers] = useState([])
  const [meta, setMeta] = useState(null)
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState({ search: '', category_id: '' })
  const [selected, setSelected] = useState(null)
  const [takeForm, setTakeForm] = useState({ member_id: '', pin: '', quantity: 1, notes: '' })
  const [message, setMessage] = useState('')
  const estimatedTotal = useMemo(() => selected ? Number(takeForm.quantity || 0) * Number(selected.selling_price_cents || 0) : 0, [selected, takeForm.quantity])

  const load = useCallback(async (page = 1) => {
    const params = new URLSearchParams({ page, search: filters.search, category_id: filters.category_id })
    const [{ data }, categoriesResponse, membersResponse] = await Promise.all([api.get(`/products?${params}`), api.get('/categories'), api.get('/members')])
    setProducts(data.data); setMeta(data); setCategories(categoriesResponse.data); setMembers(membersResponse.data)
  }, [filters.category_id, filters.search])
  useEffect(() => { load() }, [load])

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

  async function addToShoppingList(product) {
    try {
      await api.post('/shopping-list', { product_id: product.id, suggested_quantity: 1, priority: 'alta', note: 'Aggiunto da prodotto esaurito' })
      setMessage('Prodotto aggiunto alla lista della spesa.')
    } catch (err) { setMessage(errorMessage(err)) }
  }

  if (!products) return null
  return (
    <section>
      <div className="page-title"><h1>Prodotti</h1></div>
      <AlertMessage type={message.includes('registrato') || message.includes('aggiunto') ? 'success' : 'warning'}>{message}</AlertMessage>
      <div className="app-card form-grid mb-3">
        <input className="form-control" placeholder="Cerca prodotto" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <select className="form-select" value={filters.category_id} onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}><option value="">Tutte le categorie</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      </div>
      <div className="card-grid">{products.map((product) => <ProductCard key={product.id} product={product} onTake={setSelected} onAddToShoppingList={addToShoppingList} />)}</div>
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
