import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Minus, Plus, Search, ShoppingCart } from 'lucide-react'
import api from '../api/client'
import ProductCard from '../components/ProductCard'
import Pagination from '../components/Pagination'
import { errorMessage, money, quantity } from '../utils/format'
import AlertMessage from '../components/AlertMessage'
import PageHeader from '../components/layout/PageHeader'
import EmptyState from '../components/feedback/EmptyState'
import LoadingSkeleton from '../components/feedback/LoadingSkeleton'
import FormField from '../components/forms/FormField'
import UserAvatar from '../components/ui/UserAvatar'
import StatusBadge from '../components/ui/StatusBadge'
import { stockLevel } from '../utils/stock'

export default function ProductsPage() {
  const [products, setProducts] = useState(null)
  const [members, setMembers] = useState([])
  const [meta, setMeta] = useState(null)
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState({ search: '', category_id: '', availability: '' })
  const [selected, setSelected] = useState(null)
  const [takeForm, setTakeForm] = useState({ member_id: '', pin: '', quantity: 1, notes: '' })
  const [message, setMessage] = useState('')
  const maxQuantity = selected ? Number(selected.current_quantity || 0) : 1
  const estimatedTotal = useMemo(() => selected ? Number(takeForm.quantity || 0) * Number(selected.selling_price_cents || 0) : 0, [selected, takeForm.quantity])
  const visibleProducts = useMemo(() => {
    if (!products) return []
    return products.filter((product) => {
      const current = Number(product.current_quantity || 0)
      if (filters.availability === 'available') return current > 0
      if (filters.availability === 'low') return current > 0 && current <= Number(product.minimum_threshold || 0)
      if (filters.availability === 'empty') return current <= 0
      return true
    })
  }, [filters.availability, products])
  const productStats = useMemo(() => ({
    available: products?.filter((product) => Number(product.current_quantity || 0) > 0).length || 0,
    empty: products?.filter((product) => Number(product.current_quantity || 0) <= 0).length || 0,
  }), [products])

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

  function updateQuantity(nextValue) {
    const parsed = Math.max(1, Math.min(maxQuantity, Number(nextValue || 1)))
    setTakeForm({ ...takeForm, quantity: Number.isFinite(parsed) ? parsed : 1 })
  }

  if (!products) {
    return (
      <section>
        <PageHeader title="Prodotti" subtitle="Visualizza le disponibilità e registra un prelievo." />
        <LoadingSkeleton cards={8} />
      </section>
    )
  }

  const canSubmit = selected && takeForm.member_id && takeForm.pin.length === 3 && Number(takeForm.quantity) >= 1

  return (
    <section>
      <PageHeader
        title="Prodotti"
        subtitle="Visualizza le disponibilità, controlla le scorte e registra prelievi pagati o copponi."
        primaryAction={<a className="btn btn-outline-primary" href="/shopping-list"><ShoppingCart size={17} /> Lista spesa</a>}
        badge={<StatusBadge tone="info">{productStats.available} disponibili · {productStats.empty} esauriti</StatusBadge>}
      />
      <AlertMessage type={message.includes('registrato') || message.includes('aggiunto') ? 'success' : 'warning'}>{message}</AlertMessage>
      <div className="app-card filter-bar">
        <FormField label="Cerca prodotto">
          <div className="search-field">
            <Search size={18} />
            <input className="form-control" placeholder="Nome, categoria o posizione" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
        </FormField>
        <FormField label="Categoria">
          <select className="form-select" value={filters.category_id} onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}>
            <option value="">Tutte</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </FormField>
        <FormField label="Disponibilità">
          <select className="form-select" value={filters.availability} onChange={(e) => setFilters({ ...filters, availability: e.target.value })}>
            <option value="">Tutte</option>
            <option value="available">Disponibili</option>
            <option value="low">Scorta bassa</option>
            <option value="empty">Esauriti</option>
          </select>
        </FormField>
      </div>
      {visibleProducts.length ? (
        <div className="product-grid">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} onTake={(item) => { setSelected(item); setTakeForm({ member_id: '', pin: '', quantity: 1, notes: '' }) }} onAddToShoppingList={addToShoppingList} />)}</div>
      ) : (
        <EmptyState title="Nessun prodotto trovato" message="Non ci sono prodotti compatibili con i filtri selezionati." />
      )}
      <Pagination page={meta} onPage={load} />

      {selected && <div className="modal-backdrop-lite" role="dialog" aria-modal="true">
        <div className="take-panel">
          <button className="btn-close float-end" onClick={() => setSelected(null)} aria-label="Chiudi" />
          <div className="product-image take-image" aria-label={selected.image_alt || selected.name}>
            {selected.image_url ? <img src={selected.image_url} alt={selected.image_alt || selected.name} loading="lazy" /> : <span>{selected.name.slice(0, 1)}</span>}
          </div>
          <div className="stack-md">
            <div>
              <div className="cluster mb-2">
                <h2 className="h4 mb-0">{selected.name}</h2>
                <StatusBadge status={stockLevel(selected).status}>{stockLevel(selected).label}</StatusBadge>
              </div>
              <p className="text-muted-app mb-0">{money(selected.selling_price_cents)} cad. · disponibili {quantity(selected.current_quantity, selected.unit)}</p>
            </div>

            <FormField label="Membro">
              <div className="member-grid">
                {members.map((member) => (
                  <button
                    className={`member-option ${String(takeForm.member_id) === String(member.id) ? 'is-selected' : ''}`}
                    key={member.id}
                    type="button"
                    onClick={() => setTakeForm({ ...takeForm, member_id: member.id })}
                  >
                    <UserAvatar name={member.name} />
                    <span>{member.name}</span>
                  </button>
                ))}
              </div>
            </FormField>

            <FormField label="PIN personale" help="Inserisci 3 cifre. Il PIN non viene mostrato.">
              <input className="form-control form-control-lg pin-input" inputMode="numeric" type="password" maxLength="3" autoComplete="one-time-code" value={takeForm.pin} onChange={(e) => setTakeForm({ ...takeForm, pin: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
            </FormField>

            <FormField label="Quantità" help={`Massimo disponibile: ${quantity(selected.current_quantity, selected.unit)}`}>
              <div className="quantity-stepper">
                <button className="btn btn-outline-secondary" type="button" onClick={() => updateQuantity(Number(takeForm.quantity) - 1)} aria-label="Diminuisci quantità"><Minus size={17} /></button>
                <input className="form-control form-control-lg text-center" type="number" min="1" max={maxQuantity} step="1" value={takeForm.quantity} onChange={(e) => updateQuantity(e.target.value)} />
                <button className="btn btn-outline-secondary" type="button" onClick={() => updateQuantity(Number(takeForm.quantity) + 1)} aria-label="Aumenta quantità"><Plus size={17} /></button>
              </div>
            </FormField>

            <div className="summary-box split">
              <span>Totale</span>
              <strong className="h4 mb-0 num">{money(estimatedTotal)}</strong>
            </div>
            <FormField label="Nota facoltativa">
              <textarea className="form-control" rows="2" value={takeForm.notes} onChange={(e) => setTakeForm({ ...takeForm, notes: e.target.value })} />
            </FormField>
            <div className="choice-grid">
              <button className="btn btn-success btn-lg choice-button" disabled={!canSubmit} onClick={() => take('paid')}>
                <CheckCircle2 size={20} /> Pagato <small>Incassa subito</small>
              </button>
              <button className="btn btn-warning btn-lg choice-button" disabled={!canSubmit} onClick={() => take('coppone')}>
                <AlertTriangle size={20} /> Coppone <small>Aggiungi al debito</small>
              </button>
            </div>
          </div>
        </div>
      </div>}
    </section>
  )
}
