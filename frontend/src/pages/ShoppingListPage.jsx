import { useEffect, useMemo, useState } from 'react'
import { CheckSquare, Plus, ShoppingCart } from 'lucide-react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { useAuth } from '../hooks/useAuth'
import { errorMessage, money, quantity } from '../utils/format'
import PageHeader from '../components/layout/PageHeader'
import EmptyState from '../components/feedback/EmptyState'
import FormField from '../components/forms/FormField'
import StatusBadge from '../components/ui/StatusBadge'

const emptyNewProduct = { name: '', category: 'Altro', unit: 'pezzi', package_count: 1, pieces_per_package: 1, quantity: 1, unit_cost: '', minimum_threshold: 2, selling_price: '', location: '', image: null, imagePreview: '' }
const emptyExistingProduct = { product_id: '', quantity: 1, unit_cost: '', selling_price: '' }

const simplePrices = [30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300]
const toCents = (value) => Math.round(Number(String(value || '0').replace(',', '.')) * 100)
const euros = (cents) => (cents / 100).toFixed(2)
const suggestedPrice = (unitCostCents, multiplier) => simplePrices.find((price) => price >= unitCostCents * multiplier) || Math.ceil((unitCostCents * multiplier) / 10) * 10
const lineTotalCents = (row) => Math.round(Number(row.quantity || 0) * toCents(row.unit_cost))

export default function ShoppingListPage() {
  const { isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [products, setProducts] = useState([])
  const [message, setMessage] = useState('')
  const [savingListItem, setSavingListItem] = useState(false)
  const [savingRestock, setSavingRestock] = useState(false)
  const [form, setForm] = useState({ product_id: '', suggested_quantity: 1, priority: 'media', estimated_price: '', note: '' })
  const [session, setSession] = useState({ total_amount: '', purchased_at: new Date().toISOString().slice(0, 10), purchased_time: new Date().toTimeString().slice(0, 5), receipt_image: null, items: [], extraProducts: [], newProducts: [] })

  async function load() {
    const [list, productsResponse] = await Promise.all([api.get('/shopping-list?status=da_acquistare&per_page=100'), api.get('/products?per_page=200')])
    setItems(list.data.data)
    setProducts(productsResponse.data.data)
  }
  useEffect(() => { load() }, [])

  async function submit(event) {
    event.preventDefault()
    if (savingListItem) return
    setSavingListItem(true)
    setMessage('')
    try {
      await api.post('/shopping-list', form)
      setMessage('Voce aggiornata.')
      setForm({ product_id: '', suggested_quantity: 1, priority: 'media', estimated_price: '', note: '' })
      await load()
    } catch (err) { setMessage(errorMessage(err)) } finally { setSavingListItem(false) }
  }

  function toggleItem(item) {
    const exists = session.items.some((row) => row.shopping_list_item_id === item.id)
    setSession({
      ...session,
      items: exists
        ? session.items.filter((row) => row.shopping_list_item_id !== item.id)
        : [...session.items, { shopping_list_item_id: item.id, product_id: item.product_id, quantity: item.suggested_quantity, selling_price: item.product?.selling_price_cents ? euros(item.product.selling_price_cents) : '', unit_cost: '' }],
    })
  }

  function updateItem(index, field, value) {
    setSession({ ...session, items: session.items.map((row, i) => i === index ? { ...row, [field]: value } : row) })
  }

  function updateExtraProduct(index, field, value) {
    setSession({ ...session, extraProducts: session.extraProducts.map((row, i) => i === index ? { ...row, [field]: value } : row) })
  }

  function updateNewProduct(index, field, value) {
    setSession({
      ...session,
      newProducts: session.newProducts.map((row, i) => {
        if (i !== index) return row
        const next = { ...row, [field]: value }
        if (['package_count', 'pieces_per_package'].includes(field)) {
          const calculated = Number(next.package_count || 0) * Number(next.pieces_per_package || 0)
          if (calculated > 0) next.quantity = calculated
        }
        return next
      }),
    })
  }

  function updateNewProductImage(index, file) {
    if (file && !['image/webp', 'image/png', 'image/jpeg'].includes(file.type)) {
      setMessage('Formato immagine non valido. Usa WebP, PNG o JPEG.')
      return
    }
    if (file && file.size > 2 * 1024 * 1024) {
      setMessage('Immagine troppo grande. Limite 2 MB.')
      return
    }
    setSession({
      ...session,
      newProducts: session.newProducts.map((row, i) => i === index
        ? { ...row, image: file || null, imagePreview: file ? URL.createObjectURL(file) : '' }
        : row),
    })
  }

  const allRows = useMemo(() => [...session.items, ...session.extraProducts, ...session.newProducts], [session.items, session.extraProducts, session.newProducts])
  const declaredTotalCents = toCents(session.total_amount)
  const rowsTotalCents = allRows.reduce((sum, row) => sum + lineTotalCents(row), 0)
  const differenceCents = declaredTotalCents - rowsTotalCents

  function restockPayload() {
    const formData = new FormData()
    formData.append('total_amount', session.total_amount)
    formData.append('purchased_at', session.purchased_at)
    formData.append('purchased_time', session.purchased_time)
    if (session.receipt_image) formData.append('receipt_image', session.receipt_image)
    allRows.forEach((row, index) => {
      Object.entries(row).forEach(([key, value]) => {
        if (['imagePreview'].includes(key) || value === null || value === undefined || value === '') return
        formData.append(`items[${index}][${key}]`, value)
      })
    })
    return formData
  }

  async function registerRestock(event) {
    event.preventDefault()
    if (savingRestock) return
    setSavingRestock(true)
    setMessage('')
    try {
      await api.post('/shopping-list/restock-sessions', restockPayload(), { headers: { 'Content-Type': 'multipart/form-data' } })
      setMessage('Spesa registrata.')
      setSession({ total_amount: '', purchased_at: new Date().toISOString().slice(0, 10), purchased_time: new Date().toTimeString().slice(0, 5), receipt_image: null, items: [], extraProducts: [], newProducts: [] })
      await load()
    } catch (err) { setMessage(errorMessage(err)) } finally { setSavingRestock(false) }
  }

  return (
    <section>
      <PageHeader title="Lista spesa" subtitle="Checklist operativa per rifornimenti, priorità e registrazione acquisti." badge={<StatusBadge tone="info">{items.length} da acquistare</StatusBadge>} />
      <AlertMessage type={['Voce aggiornata.', 'Spesa registrata.'].includes(message) ? 'success' : 'danger'}>{message}</AlertMessage>
      <form className="app-card form-grid mb-3" onSubmit={submit}>
        <FormField label="Prodotto"><select className="form-select" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} required><option value="">Prodotto esistente</option>{products.map((p) => <option value={p.id} key={p.id}>{p.name}</option>)}</select></FormField>
        <FormField label="Quantità prevista"><input className="form-control" type="number" step="0.001" value={form.suggested_quantity} onChange={(e) => setForm({ ...form, suggested_quantity: e.target.value })} /></FormField>
        <FormField label="Priorità"><select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>bassa</option><option>media</option><option>alta</option></select></FormField>
        <FormField label="Prezzo stimato"><input className="form-control" type="number" step="0.01" value={form.estimated_price} onChange={(e) => setForm({ ...form, estimated_price: e.target.value })} /></FormField>
        <button className="btn btn-primary" disabled={savingListItem}><Plus size={17} /> {savingListItem ? 'Salvataggio...' : 'Aggiungi'}</button>
      </form>

      {items.length ? <div className="card-grid mb-3">{items.map((item) => {
        const selected = session.items.some((row) => row.shopping_list_item_id === item.id)
        return <div className="app-card stack-md" key={item.id}>
          <div className="split">
            <div><h2 className="h6 mb-1">{item.product?.name}</h2><div className="text-muted-app">{quantity(item.suggested_quantity, item.product?.unit)}</div></div>
            <StatusBadge tone={item.priority === 'alta' ? 'warning' : 'info'}>{item.priority}</StatusBadge>
          </div>
          {item.estimated_price_cents ? <p className="small text-muted-app mb-0">Stimato {money(item.estimated_price_cents)}</p> : null}
          {isAdmin && <button className={`btn ${selected ? 'btn-primary' : 'btn-outline-primary'} w-100`} onClick={() => toggleItem(item)}><CheckSquare size={17} /> {selected ? 'Selezionato' : 'Seleziona per acquisto'}</button>}
        </div>
      })}</div> : <EmptyState title="La lista della spesa è vuota" message="Aggiungi un prodotto quando una scorta sta finendo." icon={ShoppingCart} />}

      {isAdmin && <form className="app-card" onSubmit={registerRestock}>
        <div className="split mb-3"><div><h2 className="h4 mb-1">Registra spesa</h2><p className="text-muted-app mb-0">Conferma prodotti acquistati, quantità e totale scontrino.</p></div><StatusBadge tone="primary">{allRows.length} elementi</StatusBadge></div>
        <div className="form-grid mb-3">
          <FormField label="Totale scontrino"><input className="form-control" type="number" step="0.01" value={session.total_amount} onChange={(e) => setSession({ ...session, total_amount: e.target.value })} required /></FormField>
          <FormField label="Data"><input className="form-control" type="date" value={session.purchased_at} onChange={(e) => setSession({ ...session, purchased_at: e.target.value })} required /></FormField>
          <FormField label="Ora"><input className="form-control" type="time" value={session.purchased_time} onChange={(e) => setSession({ ...session, purchased_time: e.target.value })} required /></FormField>
          <FormField label="Foto scontrino" help="Facoltativa. WebP, PNG o JPEG."><input className="form-control" type="file" accept="image/webp,image/png,image/jpeg" onChange={(e) => setSession({ ...session, receipt_image: e.target.files?.[0] || null })} /></FormField>
        </div>

        <div className="summary-box stack-sm mb-3">
          <div className="split"><span>Totale righe</span><strong>{money(rowsTotalCents)}</strong></div>
          <div className="split"><span>Totale dichiarato</span><strong>{money(declaredTotalCents)}</strong></div>
          <div className="split"><span>Differenza</span><strong className={differenceCents === 0 ? 'text-success' : 'text-danger'}>{money(differenceCents)}</strong></div>
        </div>

        {session.items.map((row, index) => {
          const product = products.find((p) => p.id === Number(row.product_id))
          return <div className="purchase-row" key={row.shopping_list_item_id}>
            <div><strong>{product?.name}</strong><div className="small text-muted-app">{product?.category?.name || 'Categoria'} · prezzo attuale {money(product?.selling_price_cents || 0)}</div></div>
            <FormField label="Quantità"><input className="form-control" type="number" step="0.001" min="0.001" value={row.quantity} onChange={(e) => updateItem(index, 'quantity', e.target.value)} required /></FormField>
            <FormField label="Costo unitario originale"><input className="form-control" type="number" step="0.01" min="0" value={row.unit_cost} onChange={(e) => updateItem(index, 'unit_cost', e.target.value)} required /></FormField>
            <FormField label="Prezzo vendita"><input className="form-control" type="number" step="0.01" min="0" placeholder={euros(product?.selling_price_cents || 0)} value={row.selling_price} onChange={(e) => updateItem(index, 'selling_price', e.target.value)} /></FormField>
            <strong className="num">{money(lineTotalCents(row))}</strong>
          </div>
        })}

        {session.extraProducts.map((row, index) => {
          const product = products.find((p) => p.id === Number(row.product_id))
          return <div className="purchase-row" key={`extra-${index}`}>
            <FormField label="Prodotto esistente"><select className="form-select" value={row.product_id} onChange={(e) => updateExtraProduct(index, 'product_id', e.target.value)} required><option value="">Scegli prodotto</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></FormField>
            <FormField label="Quantità"><input className="form-control" type="number" step="0.001" min="0.001" value={row.quantity} onChange={(e) => updateExtraProduct(index, 'quantity', e.target.value)} required /></FormField>
            <FormField label="Costo unitario originale"><input className="form-control" type="number" step="0.01" min="0" value={row.unit_cost} onChange={(e) => updateExtraProduct(index, 'unit_cost', e.target.value)} required /></FormField>
            <FormField label="Prezzo vendita"><input className="form-control" type="number" step="0.01" min="0" placeholder={euros(product?.selling_price_cents || 0)} value={row.selling_price} onChange={(e) => updateExtraProduct(index, 'selling_price', e.target.value)} /></FormField>
            <strong className="num">{money(lineTotalCents(row))}</strong>
          </div>
        })}

        {session.newProducts.map((row, index) => {
          const unitCostCents = toCents(row.unit_cost)
          const suggestions = unitCostCents ? [
            ['Margine contenuto', suggestedPrice(unitCostCents, 1.3)],
            ['Margine consigliato', suggestedPrice(unitCostCents, 1.5)],
            ['Margine alto', suggestedPrice(unitCostCents, 2)],
          ] : []
          return <div className="app-card stack-md mb-3" key={`new-${index}`}>
            <div className="split"><strong>Nuovo prodotto</strong><StatusBadge tone="primary">{row.quantity || 0} pezzi</StatusBadge></div>
            <div className="form-grid">
              <FormField label="Nome prodotto"><input className="form-control" value={row.name} onChange={(e) => updateNewProduct(index, 'name', e.target.value)} required /></FormField>
              <FormField label="Categoria"><input className="form-control" value={row.category} onChange={(e) => updateNewProduct(index, 'category', e.target.value)} /></FormField>
              <FormField label="Unità"><select className="form-select" value={row.unit} onChange={(e) => updateNewProduct(index, 'unit', e.target.value)}>{['pezzi', 'bottiglie', 'confezioni', 'chilogrammi', 'grammi', 'litri', 'millilitri'].map((unit) => <option key={unit}>{unit}</option>)}</select></FormField>
              <FormField label="Confezioni"><input className="form-control" type="number" step="0.001" value={row.package_count} onChange={(e) => updateNewProduct(index, 'package_count', e.target.value)} /></FormField>
              <FormField label="Pezzi per confezione"><input className="form-control" type="number" step="0.001" value={row.pieces_per_package} onChange={(e) => updateNewProduct(index, 'pieces_per_package', e.target.value)} /></FormField>
              <FormField label="Quantità totale"><input className="form-control" type="number" step="0.001" min="0.001" value={row.quantity} onChange={(e) => updateNewProduct(index, 'quantity', e.target.value)} required /></FormField>
              <FormField label="Costo unitario originale"><input className="form-control" type="number" step="0.01" min="0" value={row.unit_cost} onChange={(e) => updateNewProduct(index, 'unit_cost', e.target.value)} required /></FormField>
              <FormField label="Prezzo vendita"><input className="form-control" type="number" step="0.01" min="0" value={row.selling_price} onChange={(e) => updateNewProduct(index, 'selling_price', e.target.value)} required /></FormField>
              <FormField label="Soglia minima"><input className="form-control" type="number" step="0.001" value={row.minimum_threshold} onChange={(e) => updateNewProduct(index, 'minimum_threshold', e.target.value)} /></FormField>
              <FormField label="Posizione"><input className="form-control" value={row.location} onChange={(e) => updateNewProduct(index, 'location', e.target.value)} /></FormField>
              <FormField label="Immagine prodotto" help="WebP, PNG o JPEG.">
                <input className="form-control" type="file" accept="image/webp,image/png,image/jpeg" onChange={(e) => updateNewProductImage(index, e.target.files?.[0])} />
              </FormField>
            </div>
            <div className="product-image" style={{ maxWidth: 180 }}>
              {row.imagePreview ? <img src={row.imagePreview} alt={`Anteprima ${row.name || 'prodotto'}`} /> : <span>{(row.name || 'N').slice(0, 1)}</span>}
            </div>
            <div className="summary-box stack-sm">
              <div className="split"><span>Totale riga</span><strong>{money(lineTotalCents(row))}</strong></div>
              {unitCostCents > 0 && <>
                <strong>Costo unitario: {money(unitCostCents)}</strong>
                <div className="cluster">
                  {suggestions.map(([label, price]) => <button className="btn btn-sm btn-outline-primary" type="button" key={label} onClick={() => updateNewProduct(index, 'selling_price', euros(price))}>{label}: {money(price)}</button>)}
                </div>
                <div className="small text-muted-app">Il prezzo suggerito è facoltativo: puoi modificarlo liberamente.</div>
              </>}
            </div>
          </div>
        })}
        <div className="cluster mt-3">
          <button type="button" className="btn btn-outline-secondary" onClick={() => setSession({ ...session, extraProducts: [...session.extraProducts, emptyExistingProduct] })}><Plus size={17} /> Prodotto esistente fuori lista</button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => setSession({ ...session, newProducts: [...session.newProducts, emptyNewProduct] })}><Plus size={17} /> Nuovo prodotto</button>
          <button className="btn btn-primary" disabled={savingRestock || allRows.length === 0}>{savingRestock ? 'Registrazione...' : 'Registra acquisto'}</button>
        </div>
      </form>}
    </section>
  )
}
