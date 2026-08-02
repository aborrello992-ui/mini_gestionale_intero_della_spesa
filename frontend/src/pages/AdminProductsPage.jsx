import { useCallback, useEffect, useMemo, useState } from 'react'
import { Archive, ImagePlus, RotateCcw, Trash2, Upload } from 'lucide-react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/tables/DataTable'
import FormField from '../components/forms/FormField'
import StatusBadge from '../components/ui/StatusBadge'
import AppModal from '../components/ui/AppModal'
import { errorMessage, money, quantity } from '../utils/format'

export default function AdminProductsPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [filters, setFilters] = useState({ state: 'active', image_state: '', category_id: '' })
  const [imageEdit, setImageEdit] = useState(null)
  const [imageForm, setImageForm] = useState({ image: null, image_alt: '', preview: '' })
  const [message, setMessage] = useState('')

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
    setImageForm({ image: null, image_alt: product.image_alt || product.name, preview: product.image_url || '' })
  }

  function pickImage(file) {
    if (file && !['image/webp', 'image/png', 'image/jpeg'].includes(file.type)) {
      setMessage('Formato immagine non valido. Usa WebP, PNG o JPEG.')
      return
    }
    if (file && file.size > 2 * 1024 * 1024) {
      setMessage('Immagine troppo grande. Limite 2 MB.')
      return
    }
    setImageForm({ ...imageForm, image: file || null, preview: file ? URL.createObjectURL(file) : imageEdit?.image_url || '' })
  }

  async function saveImage(event) {
    event.preventDefault()
    const data = new FormData()
    data.append('image', imageForm.image)
    data.append('image_alt', imageForm.image_alt || imageEdit.name)
    try {
      await api.post(`/products/${imageEdit.id}/image`, data, { headers: { 'Content-Type': 'multipart/form-data' } })
      setMessage('Immagine prodotto aggiornata.')
      setImageEdit(null)
      load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  async function removeImage(product) {
    try {
      await api.delete(`/products/${product.id}/image`)
      setMessage('Immagine rimossa.')
      load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  async function archive(product) {
    const warning = Number(product.current_quantity || 0) > 0 ? ` Questo prodotto ha ancora ${quantity(product.current_quantity, product.unit)} disponibili.` : ''
    if (!window.confirm(`Archivia ${product.name}?${warning}`)) return
    try {
      await api.delete(`/products/${product.id}`, { data: { archive_reason: 'Archiviato da pannello admin' } })
      setMessage('Prodotto archiviato.')
      load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  async function restore(product) {
    try {
      await api.post(`/products/${product.id}/restore`)
      setMessage('Prodotto ripristinato.')
      load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  const columns = [
    { key: 'product', header: 'Prodotto', render: (product) => <div className="cluster"><div className="product-image" style={{ width: 64, padding: 6 }}>{product.image_url ? <img src={product.image_url} alt={product.image_alt || product.name} /> : <span>{product.name.slice(0, 1)}</span>}</div><div><strong>{product.name}</strong><div className="small text-muted-app">{product.location?.name || 'Locale'}</div></div></div> },
    { key: 'category', header: 'Categoria', render: (product) => product.category?.name || '-' },
    { key: 'quantity', header: 'Disponibilità', align: 'right', render: (product) => quantity(product.current_quantity, product.unit) },
    { key: 'cost', header: 'Costo medio', align: 'right', render: (product) => money(product.average_price_cents || 0) },
    { key: 'price', header: 'Prezzo vendita', align: 'right', render: (product) => money(product.selling_price_cents || 0) },
    { key: 'image', header: 'Immagine', render: (product) => <StatusBadge tone={product.image_path ? 'success' : 'warning'}>{product.image_path ? 'Presente' : 'Manca'}</StatusBadge> },
    { key: 'status', header: 'Stato', render: (product) => product.archived_at ? <StatusBadge tone="neutral">Archiviato</StatusBadge> : Number(product.current_quantity || 0) <= 0 ? <StatusBadge status="esaurito" /> : <StatusBadge status="active" /> },
    { key: 'actions', header: 'Azioni', render: (product) => <div className="cluster"><button className="btn btn-sm btn-outline-primary" onClick={() => startImageEdit(product)}><ImagePlus size={15} /> Immagine</button>{product.image_path && <button className="btn btn-sm btn-outline-secondary" onClick={() => removeImage(product)}><Trash2 size={15} /> Rimuovi</button>}{product.archived_at ? <button className="btn btn-sm btn-outline-primary" onClick={() => restore(product)}><RotateCcw size={15} /> Ripristina</button> : <button className="btn btn-sm btn-outline-danger" onClick={() => archive(product)}><Archive size={15} /> Archivia</button>}</div> },
  ]

  return (
    <section>
      <PageHeader title="Prodotti admin" subtitle="Gestisci immagini, prezzi, disponibilità e archiviazione senza cancellare lo storico." badge={<StatusBadge tone={withoutImages.length ? 'warning' : 'success'}>{withoutImages.length} senza immagine</StatusBadge>} />
      <AlertMessage type={message.includes('aggiornata') || message.includes('rimossa') || message.includes('archiviato') || message.includes('ripristinato') ? 'success' : 'danger'}>{message}</AlertMessage>
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
          <div className="cluster"><button className="btn btn-outline-primary w-100" onClick={() => startImageEdit(product)}><ImagePlus size={16} /> Modifica immagine</button></div>
        </>
      )} />
      {imageEdit && <AppModal title="Modifica immagine" subtitle={imageEdit.name} onClose={() => setImageEdit(null)}>
        <form className="stack-md" onSubmit={saveImage}>
          <div className="product-image" style={{ maxWidth: 220 }}>{imageForm.preview ? <img src={imageForm.preview} alt={imageForm.image_alt || imageEdit.name} /> : <span>{imageEdit.name.slice(0, 1)}</span>}</div>
          <FormField label="Immagine" help="WebP, PNG o JPEG. Limite 2 MB."><input className="form-control" type="file" accept="image/webp,image/png,image/jpeg" onChange={(event) => pickImage(event.target.files?.[0])} required /></FormField>
          <FormField label="Testo alternativo"><input className="form-control" value={imageForm.image_alt} onChange={(event) => setImageForm({ ...imageForm, image_alt: event.target.value })} /></FormField>
          <button className="btn btn-primary btn-lg" disabled={!imageForm.image}><Upload size={18} /> Salva immagine</button>
        </form>
      </AppModal>}
    </section>
  )
}
