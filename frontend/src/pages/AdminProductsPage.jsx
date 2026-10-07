import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ImagePlus, ImageOff, Layers, Package, RotateCcw, Stethoscope, Trash2, Upload } from 'lucide-react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/tables/DataTable'
import FormField from '../components/forms/FormField'
import StatusBadge from '../components/ui/StatusBadge'
import AppModal from '../components/ui/AppModal'
import ProductThumb from '../components/ui/ProductThumb'
import ComboAdminPanel from '../components/ComboAdminPanel'
import { errorMessage, money, quantity } from '../utils/format'
import { MB, shrinkImage } from '../utils/image'

export default function AdminProductsPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState({ state: 'active', image_state: '', category_id: '' })
  const [imageEdit, setImageEdit] = useState(null)
  const [imageForm, setImageForm] = useState({ name: '', image: null, image_alt: '', preview: '', preparing: false, saving: false })
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [storageCheck, setStorageCheck] = useState(null)
  const [tab, setTab] = useState('prodotti')

  async function runStorageCheck() {
    setStorageCheck({ loading: true })
    try {
      setStorageCheck((await api.get('/storage-check')).data)
    } catch (err) {
      setStorageCheck({ ok: false, summary: errorMessage(err), steps: {} })
    }
  }

  const load = useCallback(async () => {
    const params = new URLSearchParams({ include_archived: '1', per_page: '200' })
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value) })
    const [productsResponse, categoriesResponse] = await Promise.all([api.get(`/products?${params}`), api.get('/categories')])
    setProducts(productsResponse.data.data)
    setCategories(categoriesResponse.data)
  }, [filters])

  useEffect(() => { load() }, [load])

  const withoutImages = useMemo(() => products.filter((product) => !product.image_path), [products])

  function startImageEdit(product) {
    setImageEdit(product)
    setImageForm({ name: product.name, image: null, image_alt: product.image_alt || product.name, preview: product.image_url || '', preparing: false, saving: false })
  }

  async function pickImage(file) {
    if (!file) return
    setImageForm((current) => ({ ...current, preparing: true }))
    try {
      const image = await shrinkImage(file, { maxBytes: 2 * MB, maxSide: 1200 })
      setImageForm((current) => ({ ...current, image, preview: URL.createObjectURL(image), preparing: false }))
    } catch (err) {
      setImageForm((current) => ({ ...current, preparing: false }))
      setMessage(err.message)
    }
  }

  const nameChanged = imageEdit ? imageForm.name.trim() !== imageEdit.name : false
  const canSaveEdit = imageEdit && !imageForm.preparing && !imageForm.saving && imageForm.name.trim().length >= 2 && (nameChanged || imageForm.image)

  // Nome e immagine sono indipendenti: si può cambiare uno solo dei due o entrambi.
  async function saveImage(event) {
    event.preventDefault()
    if (!canSaveEdit) return
    setImageForm((current) => ({ ...current, saving: true }))
    const name = imageForm.name.trim()
    try {
      if (nameChanged) await api.patch(`/products/${imageEdit.id}/quick`, { name })
      if (imageForm.image) {
        const data = new FormData()
        data.append('image', imageForm.image)
        data.append('image_alt', imageForm.image_alt && imageForm.image_alt !== imageEdit.name ? imageForm.image_alt : name)
        await api.post(`/products/${imageEdit.id}/image`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
      }
      setMessage(nameChanged && imageForm.image ? 'Nome e immagine aggiornati.' : nameChanged ? `Nome aggiornato: ${name}.` : 'Immagine prodotto aggiornata.')
      setImageEdit(null)
      load()
    } catch (err) {
      setMessage(errorMessage(err))
      setImageForm((current) => ({ ...current, saving: false }))
    }
  }

  async function removeImage(product) {
    try {
      await api.delete(`/products/${product.id}/image`)
      setMessage('Immagine rimossa.')
      load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  async function confirmAction() {
    if (!confirm || busy) return
    const { type, product } = confirm
    setBusy(true)
    try {
      if (type === 'archive') {
        await api.delete(`/products/${product.id}`, { data: { archive_reason: 'Archiviato da pannello admin' } })
        setMessage(`${product.name} archiviato.`)
      } else {
        await api.delete(`/products/${product.id}/permanent`)
        setMessage(`${product.name} eliminato definitivamente.`)
      }
      setConfirm(null)
      load()
    } catch (err) {
      setConfirm(null)
      setMessage(errorMessage(err))
    } finally { setBusy(false) }
  }

  async function restore(product) {
    try {
      await api.post(`/products/${product.id}/restore`)
      setMessage('Prodotto ripristinato.')
      load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  const isSuccess = /aggiornat|rimossa|archiviato|ripristinato|eliminato/.test(message)

  function renderActions(product, large = false) {
    const size = large ? '' : 'btn-sm'
    const icon = large ? 17 : 15
    return <div className={large ? 'product-admin-actions' : 'cluster'}>
      <button type="button" className={`btn ${size} btn-outline-primary`} onClick={() => startImageEdit(product)}><ImagePlus size={icon} /> {large ? 'Modifica nome/immagine' : 'Modifica'}</button>
      {product.image_path && <button type="button" className={`btn ${size} btn-outline-secondary`} onClick={() => removeImage(product)}><ImageOff size={icon} /> Rimuovi immagine</button>}
      {product.archived_at
        ? <button type="button" className={`btn ${size} btn-outline-primary`} onClick={() => restore(product)}><RotateCcw size={icon} /> Ripristina</button>
        : <button type="button" className={`btn ${size} btn-outline-warning`} onClick={() => setConfirm({ type: 'archive', product })}><Archive size={icon} /> Archivia</button>}
      <button type="button" className={`btn ${size} btn-outline-danger`} onClick={() => setConfirm({ type: 'delete', product })}><Trash2 size={icon} /> Elimina</button>
    </div>
  }

  const columns = [
    { key: 'product', header: 'Prodotto', render: (product) => <div className="cluster"><ProductThumb product={product} style={{ width: 64, padding: 6 }} /><div><strong>{product.name}</strong><div className="small text-muted-app">{product.location?.name || 'Locale'}</div></div></div> },
    { key: 'category', header: 'Categoria', render: (product) => product.category?.name || '-' },
    { key: 'quantity', header: 'Disponibilità', align: 'right', render: (product) => quantity(product.current_quantity, product.unit) },
    { key: 'cost', header: 'Costo medio', align: 'right', render: (product) => money(product.average_price_cents || 0) },
    { key: 'price', header: 'Prezzo vendita', align: 'right', render: (product) => money(product.selling_price_cents || 0) },
    { key: 'image', header: 'Immagine', render: (product) => <StatusBadge tone={product.image_path ? 'success' : 'warning'}>{product.image_path ? 'Presente' : 'Manca'}</StatusBadge> },
    { key: 'status', header: 'Stato', render: (product) => product.archived_at ? <StatusBadge tone="neutral">Archiviato</StatusBadge> : Number(product.current_quantity || 0) <= 0 ? <StatusBadge status="esaurito" /> : <StatusBadge status="active" /> },
    { key: 'actions', header: 'Azioni', render: (product) => renderActions(product) },
  ]

  return (
    <section>
      <PageHeader title="Magazzino" subtitle="Prodotti, immagini, combo e archiviazione." primaryAction={<button type="button" className="btn btn-outline-primary" onClick={runStorageCheck}><Stethoscope size={17} /> Controlla immagini</button>} badge={<StatusBadge tone={withoutImages.length ? 'warning' : 'success'}>{withoutImages.length} senza immagine</StatusBadge>} />
      <AlertMessage type={isSuccess ? 'success' : 'danger'}>{message}</AlertMessage>
      <div className="tab-strip mb-3" role="group" aria-label="Sezioni magazzino">
        <button type="button" className={`btn ${tab === 'prodotti' ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={tab === 'prodotti'} onClick={() => setTab('prodotti')}><Package size={17} /> Prodotti</button>
        <button type="button" className={`btn ${tab === 'combo' ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={tab === 'combo'} onClick={() => setTab('combo')}><Layers size={17} /> Combo</button>
      </div>
      {tab === 'combo' && <ComboAdminPanel />}
      {tab === 'prodotti' && <>
      <div className="app-card filter-bar">
        <FormField label="Stato">
          <select className="form-select" value={filters.state} onChange={(event) => setFilters({ ...filters, state: event.target.value })}>
            <option value="">Tutti</option><option value="active">Attivi</option><option value="empty">Esauriti</option><option value="archived">Archiviati</option>
          </select>
        </FormField>
        <FormField label="Immagini">
          <select className="form-select" value={filters.image_state} onChange={(event) => setFilters({ ...filters, image_state: event.target.value })}>
            <option value="">Tutti</option><option value="with">Con immagine</option><option value="without">Senza immagine</option>
          </select>
        </FormField>
        <FormField label="Categoria">
          <select className="form-select" value={filters.category_id} onChange={(event) => setFilters({ ...filters, category_id: event.target.value })}>
            <option value="">Tutte</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </FormField>
      </div>
      {withoutImages.length > 0 && <div className="summary-box mb-3">Prodotti senza immagine: {withoutImages.map((product) => product.name).join(', ')}</div>}
      <DataTable columns={columns} rows={products} getKey={(product) => product.id} emptyTitle="Nessun prodotto trovato" renderMobile={(product) => (
        <>
          <div className="split"><strong>{product.name}</strong>{product.archived_at ? <StatusBadge tone="neutral">Archiviato</StatusBadge> : <StatusBadge status={Number(product.current_quantity || 0) <= 0 ? 'esaurito' : 'active'} />}</div>
          <div className="split"><span>{quantity(product.current_quantity, product.unit)}</span><strong>{money(product.selling_price_cents || 0)}</strong></div>
          {renderActions(product, true)}
        </>
      )} />
      </>}
      {storageCheck && <AppModal title="Controllo immagini" subtitle={storageCheck.loading ? 'Prova in corso…' : storageCheck.summary} onClose={() => setStorageCheck(null)} labelledBy="storage-check-title">
        {storageCheck.loading ? <p className="mb-0">Salvo, rileggo e apro un file di prova…</p> : <div className="stack-sm">
          {Object.entries(storageCheck.steps || {}).map(([step, outcome]) => <div className={`summary-box ${outcome.ok ? '' : 'border-danger'}`} key={step}>
            <div className="split"><strong className="text-capitalize">{step.replaceAll('_', ' ')}</strong><StatusBadge tone={outcome.ok ? 'success' : 'danger'}>{outcome.ok ? 'OK' : 'Errore'}</StatusBadge></div>
            <div className="small text-break">{outcome.message}</div>
          </div>)}
          {storageCheck.php_limits && <div className="small text-muted-app">Limiti PHP: file {storageCheck.php_limits.upload_max_filesize}, richiesta {storageCheck.php_limits.post_max_size}</div>}
          <button type="button" className="btn btn-primary" onClick={runStorageCheck}>Ripeti controllo</button>
        </div>}
      </AppModal>}
      {confirm && <AppModal title={confirm.type === 'delete' ? 'Eliminare definitivamente?' : 'Archiviare il prodotto?'} subtitle={confirm.product.name} onClose={() => !busy && setConfirm(null)} labelledBy="product-confirm-title">
        <div className="stack-md">
          {confirm.type === 'delete'
            ? <p className="mb-0">Stai per eliminare <strong>{confirm.product.name}</strong>. L'operazione non si può annullare ed è permessa solo se il prodotto non ha prelievi, rifornimenti o altri movimenti. Se ha uno storico, archivialo.</p>
            : <p className="mb-0">{confirm.product.name} non sarà più visibile ai soci. Lo storico resta e puoi ripristinarlo quando vuoi.{Number(confirm.product.current_quantity || 0) > 0 ? ` Ha ancora ${quantity(confirm.product.current_quantity, confirm.product.unit)} disponibili.` : ''}</p>}
          <div className="product-admin-actions">
            <button type="button" className="btn btn-outline-secondary btn-lg" onClick={() => setConfirm(null)} disabled={busy}>Annulla</button>
            <button type="button" className={`btn btn-lg ${confirm.type === 'delete' ? 'btn-danger' : 'btn-warning'}`} onClick={confirmAction} disabled={busy} autoFocus>{busy ? 'Attendi…' : confirm.type === 'delete' ? `Elimina ${confirm.product.name}` : 'Archivia'}</button>
          </div>
        </div>
      </AppModal>}
      {imageEdit && <AppModal title="Modifica prodotto" subtitle={imageEdit.name} onClose={() => !imageForm.saving && setImageEdit(null)} labelledBy="product-edit-title">
        <form className="stack-md" onSubmit={saveImage}>
          <FormField label="Nome prodotto" htmlFor="product-edit-name" help="Lascia com'è se vuoi cambiare solo l'immagine.">
            <input id="product-edit-name" className="form-control form-control-lg" maxLength={255} value={imageForm.name} onChange={(event) => setImageForm({ ...imageForm, name: event.target.value })} required />
          </FormField>
          <div className="restock-photo-row">
            <div className="product-image restock-thumb">{imageForm.preview ? <img src={imageForm.preview} alt={imageForm.image_alt || imageEdit.name} /> : <span>{imageEdit.name.slice(0, 1)}</span>}</div>
            <div className="stack-sm min-0">
              <label className="btn btn-outline-primary" htmlFor="product-edit-image"><ImagePlus size={17} /> {imageEdit.image_path || imageForm.image ? 'Cambia immagine' : 'Aggiungi immagine'}</label>
              <input id="product-edit-image" className="visually-hidden" type="file" accept="image/*" onChange={(event) => { pickImage(event.target.files?.[0]); event.target.value = '' }} />
              <div className="field-help">{imageForm.preparing ? 'Riduco la foto…' : 'Facoltativa. Le foto del telefono vengono ridotte automaticamente.'}</div>
            </div>
          </div>
          {imageForm.image && <FormField label="Testo alternativo" htmlFor="product-edit-alt"><input id="product-edit-alt" className="form-control" value={imageForm.image_alt} onChange={(event) => setImageForm({ ...imageForm, image_alt: event.target.value })} /></FormField>}
          <button className="btn btn-primary btn-lg" disabled={!canSaveEdit}><Upload size={18} /> {imageForm.saving ? 'Salvataggio…' : nameChanged && imageForm.image ? 'Salva nome e immagine' : nameChanged ? 'Salva nome' : 'Salva immagine'}</button>
        </form>
      </AppModal>}
    </section>
  )
}
