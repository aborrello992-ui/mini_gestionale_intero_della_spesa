import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Minus, Plus, Search, ShoppingCart, Users } from 'lucide-react'
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
import CheckoutModal from '../components/CheckoutModal'
import ArcadeBurst from '../components/ArcadeBurst'
import { useWaitScene } from '../hooks/useWaitScene'
import { useAuth } from '../hooks/useAuth'

export default function ProductsPage() {
  const [products, setProducts] = useState(null)
  const [members, setMembers] = useState([])
  const [meta, setMeta] = useState(null)
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState({ search: '', category_id: '', availability: '' })
  const [selected, setSelected] = useState(null)
  const [takeForm, setTakeForm] = useState({ member_id: '', pin: '', quantity: 1, notes: '' })
  const [message, setMessage] = useState('')
  const { user, isPersonal, isGuest } = useAuth()
  const [combos, setCombos] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [checkout, setCheckout] = useState(null)
  const [celebration, setCelebration] = useState(null)
  const { run: runWithScene, scene: waitScene } = useWaitScene()
  const closeCelebration = useCallback(() => setCelebration(null), [])

  // Pagato: festa dorata. Coppone: avvertimento rosso, stessa esplosione.
  function celebrate(kind, subtitle) {
    setCelebration(kind === 'coppone'
      ? { tone: 'red', label: 'Coppone', words: ['RICORDATI,', 'NON TE NE', 'DIMENTICARE,', 'SENNÒ', 'TI VENGO', 'A PRENDERE!'], subtitle }
      : { tone: 'gold', label: 'Pagato!', words: ['SEI', 'UN', 'BOMBONE!'], subtitle })
  }

  const loadCombos = useCallback(() => api.get('/combos').then(({ data }) => setCombos(data)).catch(() => setCombos([])), [])
  useEffect(() => { loadCombos() }, [loadCombos])

  async function openCheckout(lines = [], people = 2) {
    setSelected(null)
    setCheckout({ lines, people })
    try {
      setAllProducts((await api.get('/products?per_page=500&availability=available')).data.data)
    } catch (err) { setMessage(errorMessage(err)) }
  }

  function checkoutDone(result) {
    setCheckout(null)
    const label = { paid: 'pagato', coppone: 'a coppone', pending: 'da verificare (ospite)' }
    const parts = result.shares.map((share) => `${share.name} ${money(share.total_cents)} ${label[share.payment_status] || share.payment_status}`)
    setMessage(`Acquisto registrato: ${parts.join(' · ')}.`)
    celebrate(result.shares.some((share) => share.payment_status === 'coppone') ? 'coppone' : 'paid', parts.join(' · '))
    load(meta?.current_page || 1)
    loadCombos()
  }
  const maxQuantity = selected ? Number(selected.current_quantity || 0) : 1
  const estimatedTotal = useMemo(() => selected ? Number(takeForm.quantity || 0) * Number(selected.selling_price_cents || 0) : 0, [selected, takeForm.quantity])
  const availableProducts = useMemo(() => (products || []).filter((product) => Number(product.current_quantity || 0) > 0), [products])
  const emptyProducts = useMemo(() => (products || []).filter((product) => Number(product.current_quantity || 0) <= 0), [products])

  useEffect(() => {
    Promise.all([api.get('/categories'), api.get('/members?include_guests=1')])
      .then(([categoriesResponse, membersResponse]) => { setCategories(categoriesResponse.data); setMembers(membersResponse.data) })
      .catch((err) => setMessage(errorMessage(err)))
  }, [])

  const load = useCallback(async (page = 1) => {
    const params = new URLSearchParams({ page, search: filters.search, category_id: filters.category_id, availability: filters.availability })
    try {
      const { data } = await api.get(`/products?${params}`)
      setProducts(data.data); setMeta(data)
    } catch (err) {
      setMessage(errorMessage(err))
      setProducts((current) => current || [])
    }
  }, [filters.availability, filters.category_id, filters.search])

  // La ricerca aspetta che si smetta di scrivere prima di interrogare il server.
  useEffect(() => {
    const timer = setTimeout(() => load(), filters.search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, filters.search])

  async function take(paymentStatus) {
    setMessage('')
    try {
      // L'attesa mostra l'avatar di chi sta prendendo il prodotto.
      const taker = isPersonal ? user : members.find((member) => String(member.id) === String(takeForm.member_id))
      const { data } = await runWithScene(paymentStatus === 'coppone' ? 'coppone' : 'pay', taker, (idempotencyKey) => api.post('/withdrawals', {
        product_id: selected.id,
        // Chi è entrato con il proprio PIN preleva per sé senza ridigitarlo.
        member_id: isPersonal ? user.id : takeForm.member_id,
        pin: isPersonal ? undefined : takeForm.pin,
        quantity: takeForm.quantity,
        payment_status: paymentStatus,
        notes: takeForm.notes,
        // Ospite: un socio presente fa da garante con il suo PIN.
        ...(isGuest ? { sponsor_id: takeForm.sponsor_id, sponsor_pin: takeForm.sponsor_pin } : {}),
      }, { headers: { 'Idempotency-Key': idempotencyKey } }))
      setMessage(data.payment_status === 'pending'
        ? `Acquisto registrato: metti ${money(data.total_amount_cents)} in cassa. Un amministratore verificherà il pagamento.`
        : `${paymentStatus === 'paid' ? 'Pagato' : 'Coppone'} registrato: ${money(data.total_amount_cents)}.`)
      celebrate(paymentStatus, data.payment_status === 'pending'
        ? `${selected.name} · metti ${money(data.total_amount_cents)} in cassa`
        : `${selected.name} · ${money(data.total_amount_cents)}${paymentStatus === 'coppone' ? ' segnati sul tuo conto' : ''}`)
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

  function openTake(product) {
    setSelected(product)
    setTakeForm({ member_id: '', pin: '', quantity: 1, notes: '' })
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

  const sponsors = members.filter((member) => member.role !== 'guest')
  const sponsorReady = !isGuest || (takeForm.sponsor_id && /^\d{3}$/.test(takeForm.sponsor_pin || ''))
  const canSubmit = selected && (isPersonal || (takeForm.member_id && takeForm.pin.length === 3)) && sponsorReady && Number(takeForm.quantity) >= 1

  return (
    <section>
      <PageHeader
        title="Prodotti"
        subtitle="Visualizza le disponibilità, controlla le scorte e registra prelievi pagati o copponi."
        secondaryAction={<a className="btn btn-outline-primary" href="/shopping-list"><ShoppingCart size={17} /> Lista spesa</a>}
        primaryAction={<button type="button" className="btn btn-primary" onClick={() => openCheckout([], 2)}><Users size={17} /> Mangia con un amico</button>}
        badge={<StatusBadge tone="info">{meta?.availability_counts?.available ?? 0} disponibili · {meta?.availability_counts?.empty ?? 0} esauriti</StatusBadge>}
      />
      <AlertMessage type={message.includes('registrato') || message.includes('aggiunto') ? 'success' : 'warning'}>{message}</AlertMessage>
      {combos.length > 0 && <section className="mb-4" aria-labelledby="combo-title">
        <h2 className="section-title mb-3" id="combo-title">★ Combo</h2>
        <div className="combo-grid">{[...combos].sort((a, b) => (b.available_count > 0) - (a.available_count > 0)).map((combo) => {
          const saving = combo.list_price_cents - combo.price_cents
          const soldOut = combo.available_count <= 0
          return <article className={`combo-card ${soldOut ? 'is-empty' : ''}`} key={combo.id}>
            <div className="combo-card-head">
              <h3>{combo.name}</h3>
              {saving > 0 && <span className="combo-badge">−{money(saving)}</span>}
            </div>
            <p className="combo-items">{combo.items.map((item) => `${Number(item.quantity)}× ${item.product?.name}`).join(' + ')}</p>
            {combo.description && <p className="small text-muted-app mb-0">{combo.description}</p>}
            <div className="combo-price"><strong>{money(combo.price_cents)}</strong>{saving > 0 && <s>{money(combo.list_price_cents)}</s>}</div>
            <div className="product-admin-actions">
              <button type="button" className="btn btn-primary" disabled={soldOut} onClick={() => openCheckout([{ combo_id: combo.id, quantity: 1 }], 1)}>{soldOut ? 'Esaurita' : 'Prendi'}</button>
              <button type="button" className="btn btn-outline-primary" disabled={soldOut} onClick={() => openCheckout([{ combo_id: combo.id, quantity: 1 }], 2)}><Users size={16} /> In due</button>
            </div>
          </article>
        })}</div>
      </section>}
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
      {products.length ? (
        <>
          {availableProducts.length > 0 && <div className="product-grid">{availableProducts.map((product) => <ProductCard key={product.id} product={product} onTake={openTake} onAddToShoppingList={addToShoppingList} />)}</div>}
          {emptyProducts.length > 0 && <>
            <h2 className="section-title mt-4 mb-3">Esauriti</h2>
            <div className="product-grid">{emptyProducts.map((product) => <ProductCard key={product.id} product={product} onTake={openTake} onAddToShoppingList={addToShoppingList} />)}</div>
          </>}
        </>
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

            {isPersonal
              ? <>
                <div className="summary-box split"><span>Prendi come <strong>{user.name}</strong></span><UserAvatar name={user.name} size="sm" /></div>
                {isGuest && <fieldset className="checkout-person">
                  <legend className="form-label mb-0">Socio garante</legend>
                  <p className="small text-muted-app mb-0">Un socio presente conferma il tuo acquisto con il suo PIN. Poi metti i soldi in cassa: un amministratore li verifica.</p>
                  <div className="restock-two">
                    <div><label className="form-label" htmlFor="sponsor-member">Socio</label><select id="sponsor-member" className="form-select" value={takeForm.sponsor_id || ''} onChange={(e) => setTakeForm({ ...takeForm, sponsor_id: e.target.value })}><option value="">Chi garantisce?</option>{sponsors.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
                    <div><label className="form-label" htmlFor="sponsor-pin">PIN del socio</label><input id="sponsor-pin" className="form-control pin-input" type="password" inputMode="numeric" autoComplete="off" maxLength="3" value={takeForm.sponsor_pin || ''} onChange={(e) => setTakeForm({ ...takeForm, sponsor_pin: e.target.value.replace(/\D/g, '').slice(0, 3) })} /></div>
                  </div>
                </fieldset>}
              </>
              : <>
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

              </>}

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
                <CheckCircle2 size={20} /> {isGuest ? 'Prendi e pago in cassa' : 'Pagato'} <small>{isGuest ? 'Verifica di un amministratore' : 'Incassa subito'}</small>
              </button>
              {!isGuest && <button className="btn btn-warning btn-lg choice-button" disabled={!canSubmit} onClick={() => take('coppone')}>
                <AlertTriangle size={20} /> Coppone <small>Aggiungi al debito</small>
              </button>}
            </div>
            <button type="button" className="btn btn-outline-primary w-100" onClick={() => openCheckout([{ product_id: selected.id, quantity: Number(takeForm.quantity) || 1 }], 2)}><Users size={17} /> Dividi con un amico</button>
          </div>
        </div>
      </div>}
      {waitScene}
      {celebration && <ArcadeBurst tone={celebration.tone} label={celebration.label} words={celebration.words} subtitle={celebration.subtitle} autoCloseMs={celebration.tone === 'red' ? 7000 : 5000} onClose={closeCelebration} />}
      {checkout && <CheckoutModal members={members} products={allProducts} combos={combos} initialLines={checkout.lines} initialPeople={checkout.people} onClose={() => setCheckout(null)} onDone={checkoutDone} />}
    </section>
  )
}
