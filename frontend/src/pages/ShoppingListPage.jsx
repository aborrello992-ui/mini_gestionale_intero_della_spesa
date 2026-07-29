import { useEffect, useState } from 'react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { useAuth } from '../hooks/useAuth'
import { errorMessage, money, quantity } from '../utils/format'

const emptyNewProduct = { name: '', category: 'Altro', unit: 'pezzi', quantity: 1, minimum_threshold: 2, selling_price: '', location: '' }

export default function ShoppingListPage() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ product_id: '', suggested_quantity: 1, priority: 'media', estimated_price: '', note: '' })
  const [session, setSession] = useState({ total_amount: '', purchased_at: new Date().toISOString().slice(0, 10), purchased_time: new Date().toTimeString().slice(0, 5), items: [], newProducts: [] })

  async function load() {
    const [list, productsResponse] = await Promise.all([api.get('/shopping-list?status=da_acquistare&per_page=100'), api.get('/products?per_page=200')])
    setItems(list.data.data); setProducts(productsResponse.data.data)
  }
  useEffect(() => { load() }, [])

  async function submit(event) {
    event.preventDefault()
    setMessage('')
    try { await api.post('/shopping-list', form); setMessage('Voce aggiornata.'); load() } catch (err) { setMessage(errorMessage(err)) }
  }

  function toggleItem(item) {
    const exists = session.items.some((row) => row.shopping_list_item_id === item.id)
    setSession({
      ...session,
      items: exists
        ? session.items.filter((row) => row.shopping_list_item_id !== item.id)
        : [...session.items, { shopping_list_item_id: item.id, product_id: item.product_id, quantity: item.suggested_quantity, selling_price: '', cost_amount: '' }],
    })
  }

  function updateItem(index, field, value) {
    setSession({ ...session, items: session.items.map((row, i) => i === index ? { ...row, [field]: value } : row) })
  }

  function updateNewProduct(index, field, value) {
    setSession({ ...session, newProducts: session.newProducts.map((row, i) => i === index ? { ...row, [field]: value } : row) })
  }

  async function registerRestock(event) {
    event.preventDefault()
    setMessage('')
    try {
      await api.post('/shopping-list/restock-sessions', {
        total_amount: session.total_amount,
        purchased_at: session.purchased_at,
        purchased_time: session.purchased_time,
        items: [...session.items, ...session.newProducts],
      })
      setMessage('Spesa registrata.')
      setSession({ total_amount: '', purchased_at: new Date().toISOString().slice(0, 10), purchased_time: new Date().toTimeString().slice(0, 5), items: [], newProducts: [] })
      load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  return (
    <section>
      <div className="page-title"><h1>Lista della spesa</h1></div>
      <AlertMessage type={['Voce aggiornata.', 'Spesa registrata.'].includes(message) ? 'success' : 'danger'}>{message}</AlertMessage>
      <form className="app-card form-grid mb-3" onSubmit={submit}>
        <select className="form-select" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required><option value="">Prodotto esistente</option>{products.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select>
        <input className="form-control" type="number" step="0.001" value={form.suggested_quantity} onChange={(e) => setForm({ ...form, suggested_quantity: e.target.value })} />
        <select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>bassa</option><option>media</option><option>alta</option></select>
        <input className="form-control" type="number" step="0.01" placeholder="Prezzo stimato" value={form.estimated_price} onChange={(e) => setForm({ ...form, estimated_price: e.target.value })} />
        <button className="btn btn-primary">Aggiungi</button>
      </form>

      <div className="card-grid mb-3">{items.map((item) => <div className="app-card" key={item.id}>
        <h2 className="h6">{item.product?.name}</h2>
        <p>{quantity(item.suggested_quantity, item.product?.unit)} · priorità {item.priority}</p>
        {item.estimated_price_cents ? <p className="small text-secondary">Stimato {money(item.estimated_price_cents)}</p> : null}
        {isAdmin && <button className="btn btn-outline-primary w-100" onClick={() => toggleItem(item)}>{session.items.some((row) => row.shopping_list_item_id === item.id) ? 'Rimuovi dalla spesa' : 'Seleziona per acquisto'}</button>}
      </div>)}</div>

      {isAdmin && <form className="app-card" onSubmit={registerRestock}>
        <h2 className="h4">Registra spesa</h2>
        <div className="form-grid mb-3">
          <input className="form-control" type="number" step="0.01" placeholder="Totale scontrino" value={session.total_amount} onChange={(e) => setSession({ ...session, total_amount: e.target.value })} required />
          <input className="form-control" type="date" value={session.purchased_at} onChange={(e) => setSession({ ...session, purchased_at: e.target.value })} />
          <input className="form-control" type="time" value={session.purchased_time} onChange={(e) => setSession({ ...session, purchased_time: e.target.value })} />
        </div>
        {session.items.map((row, index) => {
          const product = products.find((p) => p.id === Number(row.product_id))
          return <div className="purchase-row" key={row.shopping_list_item_id}>
            <strong>{product?.name}</strong>
            <input className="form-control" type="number" step="0.001" value={row.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} />
            <input className="form-control" type="number" step="0.01" placeholder="Prezzo vendita" value={row.selling_price} onChange={(e) => updateItem(index, 'selling_price', e.target.value)} />
            <input className="form-control" type="number" step="0.01" placeholder="Costo attribuito" value={row.cost_amount} onChange={(e) => updateItem(index, 'cost_amount', e.target.value)} />
          </div>
        })}
        {session.newProducts.map((row, index) => <div className="purchase-row" key={`new-${index}`}>
          <input className="form-control" placeholder="Nuovo prodotto" value={row.name} onChange={(e) => updateNewProduct(index, 'name', e.target.value)} />
          <input className="form-control" type="number" step="0.001" placeholder="Quantità" value={row.quantity} onChange={(e) => updateNewProduct(index, 'quantity', e.target.value)} />
          <input className="form-control" type="number" step="0.01" placeholder="Prezzo vendita" value={row.selling_price} onChange={(e) => updateNewProduct(index, 'selling_price', e.target.value)} />
          <select className="form-select" value={row.unit} onChange={(e) => updateNewProduct(index, 'unit', e.target.value)}>{['pezzi', 'bottiglie', 'confezioni', 'chilogrammi', 'grammi', 'litri', 'millilitri'].map((unit) => <option key={unit}>{unit}</option>)}</select>
          <input className="form-control" type="number" step="0.001" placeholder="Soglia minima" value={row.minimum_threshold} onChange={(e) => updateNewProduct(index, 'minimum_threshold', e.target.value)} />
          <input className="form-control" placeholder="Posizione" value={row.location} onChange={(e) => updateNewProduct(index, 'location', e.target.value)} />
        </div>)}
        <button type="button" className="btn btn-outline-secondary me-2" onClick={() => setSession({ ...session, newProducts: [...session.newProducts, emptyNewProduct] })}>Aggiungi nuovo prodotto</button>
        <button className="btn btn-primary">Registra acquisto</button>
      </form>}
    </section>
  )
}
