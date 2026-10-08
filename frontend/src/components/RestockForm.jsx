import { useEffect, useId, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Camera, Check, ImagePlus, ListChecks, PackagePlus, Plus, ReceiptText, Search, Trash2 } from 'lucide-react'
import api from '../api/client'
import AlertMessage from './AlertMessage'
import StatusBadge from './ui/StatusBadge'
import { MB, shrinkImage } from '../utils/image'
import { EXPENSE_CATEGORIES } from '../utils/restock'
import { useAuth } from '../hooks/useAuth'
import { useWaitScene } from '../hooks/useWaitScene'
import { centsToInput, errorMessage, localDate, localTime, money, newUuid, quantity as formatQuantity, toCents } from '../utils/format'

const UNITS = ['pezzi', 'bustine', 'porzioni', 'bottiglie', 'confezioni', 'chilogrammi', 'grammi', 'litri', 'millilitri']
const NEW_CATEGORY = '__nuova'
const DIFFERENCE_REASONS = [
  ['arrotondamento', 'Arrotondamento'],
  ['sacchetto', 'Sacchetto non inserito'],
  ['sconto', 'Sconto sullo scontrino'],
  ['altro_costo', 'Altro costo non inserito'],
  ['errore', 'Errore di inserimento'],
]
const STEPS = ['Scontrino', 'Prodotti', 'Controllo']
const MARKUPS = [['Pari costo', 1], ['+30%', 1.3], ['+50%', 1.5], ['+100%', 2]]

const normalize = (value) => String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const toNumber = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}
const emptyReceipt = () => ({ total_amount: '', purchased_at: localDate(), purchased_time: localTime(), receipt_image: null, receipt_preview: '', difference_reason: '', note: '' })
let rowCounter = 0
const rowId = () => { rowCounter += 1; return `row-${rowCounter}` }

const baseProductRow = { quantity: '1', package_count: '', pieces_per_package: '', costMode: 'line', unit_cost: '', line_cost: '', selling_price: '' }

function rowQuantity(row) {
  const direct = toNumber(row.quantity)
  if (direct > 0) return direct
  return toNumber(row.package_count) * toNumber(row.pieces_per_package)
}

function hasCost(row) {
  return row.kind === 'expense' || (row.costMode === 'line' ? row.line_cost !== '' : row.unit_cost !== '')
}

/** Costo totale riga in centesimi: esatto se inserito come totale, altrimenti quantità × costo a pezzo. */
function lineCostCents(row) {
  if (row.kind === 'expense' || row.costMode === 'line') return toCents(row.line_cost)
  return Math.round(rowQuantity(row) * toCents(row.unit_cost))
}

function unitCostCents(row) {
  if (row.costMode === 'unit') return toCents(row.unit_cost)
  const qty = rowQuantity(row)
  return qty > 0 ? lineCostCents(row) / qty : 0
}

function suggestedPrice(costCents, multiplier) {
  if (multiplier === 1) return Math.ceil(costCents)
  return Math.ceil((costCents * multiplier) / 10) * 10
}

function rowLabel(row) {
  if (row.kind === 'expense') return row.description || EXPENSE_CATEGORIES.find(([value]) => value === row.expense_category)?.[1] || 'Voce non magazzino'
  return row.kind === 'new' ? (row.name || 'Prodotto nuovo') : row.productName
}

function rowErrors(row) {
  const errors = {}
  if (row.kind === 'expense') {
    if (!row.expense_category) errors.expense_category = 'Scegli una categoria.'
    if (row.line_cost === '' || toCents(row.line_cost) < 0) errors.line_cost = "Inserisci l'importo."
    return errors
  }
  if (rowQuantity(row) <= 0) errors.quantity = 'La quantità deve essere maggiore di zero.'
  if (!hasCost(row)) errors.cost = 'Inserisci quanto hai pagato (0 se omaggio).'
  if (row.kind === 'new') {
    if (!row.name.trim()) errors.name = 'Inserisci il nome.'
    if (!row.categoryChoice) errors.category = 'Scegli la categoria.'
    if (row.categoryChoice === NEW_CATEGORY && !row.newCategory.trim()) errors.category = 'Scrivi il nome della nuova categoria.'
    if (row.selling_price === '') errors.selling_price = 'Inserisci il prezzo di vendita.'
  }
  return errors
}

export default function RestockForm({ products, listItems, reminders = [], categories: categoryList = [], onSaved }) {
  const formId = useId()
  const { user } = useAuth()
  const { run: runWithScene, scene: waitScene } = useWaitScene()
  const [step, setStep] = useState(0)
  const [receipt, setReceipt] = useState(emptyReceipt)
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(newUuid)
  const [saving, setSaving] = useState(false)
  const [preparingPhoto, setPreparingPhoto] = useState(false)
  const [message, setMessage] = useState({ type: 'danger', text: '' })
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => () => {
    if (receipt.receipt_preview) URL.revokeObjectURL(receipt.receipt_preview)
  }, [receipt.receipt_preview])

  const productRows = rows.filter((row) => row.kind !== 'expense')
  const expenseRows = rows.filter((row) => row.kind === 'expense')
  const productsTotal = productRows.reduce((sum, row) => sum + lineCostCents(row), 0)
  const expensesTotal = expenseRows.reduce((sum, row) => sum + lineCostCents(row), 0)
  const receiptTotal = toCents(receipt.total_amount)
  const difference = receiptTotal - productsTotal - expensesTotal
  const categories = useMemo(() => {
    const names = categoryList.length ? categoryList.map((category) => category.name) : products.map((product) => product.category?.name)
    return [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'))
  }, [categoryList, products])
  const usedProductIds = useMemo(() => new Set(rows.map((row) => row.product_id).filter(Boolean)), [rows])
  const invalidRows = rows.filter((row) => Object.keys(rowErrors(row)).length > 0)

  const searchResults = useMemo(() => {
    const term = normalize(search)
    if (!term) return []
    return products.filter((product) => normalize(product.name).includes(term)).slice(0, 8)
  }, [products, search])
  const openListItems = listItems.filter((item) => !rows.some((row) => row.shopping_list_item_id === item.id))
  const openReminders = reminders.filter((product) => !usedProductIds.has(product.id) && !listItems.some((item) => item.product_id === product.id))

  function updateReceipt(field, value) { setReceipt((current) => ({ ...current, [field]: value })) }

  function updateRow(id, patch) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  function removeRow(id) {
    setRows((current) => {
      const row = current.find((item) => item.id === id)
      if (row?.imagePreview) URL.revokeObjectURL(row.imagePreview)
      return current.filter((item) => item.id !== id)
    })
  }

  function addExisting(product, listItem = null) {
    if (usedProductIds.has(product.id)) {
      setMessage({ type: 'warning', text: `${product.name} è già nello scontrino: modifica la quantità nella sua scheda.` })
      return
    }
    setRows((current) => [...current, {
      ...baseProductRow,
      id: rowId(),
      kind: 'existing',
      product_id: product.id,
      productName: product.name,
      unit: product.unit,
      currentSellingCents: Number(product.selling_price_cents || 0),
      averageCostCents: Number(product.average_price_cents || 0),
      shopping_list_item_id: listItem?.id || null,
      quantity: listItem ? String(Number(listItem.suggested_quantity || 1)) : '1',
      selling_price: product.selling_price_cents ? centsToInput(product.selling_price_cents) : '',
    }])
    setSearch('')
    setMessage({ type: 'danger', text: '' })
  }

  function addNew(prefill = {}) {
    const { category, ...rest } = prefill
    const known = category && categories.find((name) => name.toLowerCase() === category.toLowerCase())
    const categoryFields = !category ? { categoryChoice: '', newCategory: '' } : known ? { categoryChoice: known, newCategory: '' } : { categoryChoice: NEW_CATEGORY, newCategory: category }
    setRows((current) => [...current, { ...baseProductRow, id: rowId(), kind: 'new', name: search.trim(), ...categoryFields, unit: 'pezzi', minimum_threshold: '2', image: null, imagePreview: '', shopping_list_item_id: null, ...rest }])
    setSearch('')
  }

  function addFromList(item) {
    const product = products.find((candidate) => candidate.id === item.product_id) || item.product
    if (product) addExisting(product, item)
    else addNew({ name: item.suggested_name || '', category: item.suggested_category || '', quantity: String(Number(item.suggested_quantity || 1)), shopping_list_item_id: item.id })
  }

  function addExpense() {
    setRows((current) => [...current, { id: rowId(), kind: 'expense', expense_category: 'sacchetti', description: '', line_cost: '' }])
  }

  async function pickReceiptPhoto(file) {
    if (!file) return
    setPreparingPhoto(true)
    try {
      const image = await shrinkImage(file, { maxBytes: 4 * MB, maxSide: 2000 })
      setReceipt((current) => ({ ...current, receipt_image: image, receipt_preview: URL.createObjectURL(image) }))
      setMessage({ type: 'danger', text: '' })
    } catch (error) {
      setMessage({ type: 'danger', text: error.message })
    } finally { setPreparingPhoto(false) }
  }

  async function pickProductPhoto(row, file) {
    if (!file) return
    setPreparingPhoto(true)
    try {
      const image = await shrinkImage(file, { maxBytes: 2 * MB, maxSide: 1200 })
      if (row.imagePreview) URL.revokeObjectURL(row.imagePreview)
      updateRow(row.id, { image, imagePreview: URL.createObjectURL(image) })
    } catch (error) {
      setMessage({ type: 'danger', text: error.message })
    } finally { setPreparingPhoto(false) }
  }

  function stepProblem(target) {
    if (target >= 1) {
      if (receiptTotal <= 0) return 'Inserisci il totale dello scontrino.'
      if (!receipt.purchased_at || !receipt.purchased_time) return 'Inserisci data e ora della spesa.'
    }
    if (target >= 2) {
      if (!rows.length) return 'Aggiungi almeno un prodotto o una voce.'
      if (invalidRows.length) return `Completa la scheda «${rowLabel(invalidRows[0])}».`
    }
    return ''
  }

  function goTo(target) {
    const problem = target > step ? stepProblem(target) : ''
    if (problem) {
      setShowErrors(true)
      setMessage({ type: 'danger', text: problem })
      return
    }
    setShowErrors(false)
    setMessage({ type: 'danger', text: '' })
    setStep(target)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function payload() {
    const data = new FormData()
    data.append('idempotency_key', idempotencyKey)
    data.append('total_amount', centsToInput(receiptTotal))
    data.append('purchased_at', receipt.purchased_at)
    data.append('purchased_time', receipt.purchased_time)
    if (receipt.receipt_image) data.append('receipt_image', receipt.receipt_image)
    if (difference !== 0 && receipt.difference_reason) data.append('difference_reason', receipt.difference_reason)
    if (receipt.note.trim()) data.append('note', receipt.note.trim())

    rows.forEach((row, index) => {
      const put = (key, value) => { if (value !== null && value !== undefined && value !== '') data.append(`items[${index}][${key}]`, value) }
      if (row.kind === 'expense') {
        put('item_type', 'expense')
        put('expense_category', row.expense_category)
        put('description', row.description.trim())
        put('line_cost', centsToInput(toCents(row.line_cost)))
        return
      }
      put('item_type', 'product')
      put('quantity', rowQuantity(row))
      put('package_count', row.package_count)
      put('pieces_per_package', row.pieces_per_package)
      put('note', row.portion_note)
      if (row.costMode === 'line') put('line_cost', centsToInput(toCents(row.line_cost)))
      else put('unit_cost', centsToInput(toCents(row.unit_cost)))
      if (row.selling_price !== '') put('selling_price', centsToInput(toCents(row.selling_price)))
      if (row.kind === 'existing') {
        put('product_id', row.product_id)
        put('shopping_list_item_id', row.shopping_list_item_id)
      } else {
        put('name', row.name.trim())
        put('category', row.categoryChoice === NEW_CATEGORY ? row.newCategory.trim() : row.categoryChoice)
        put('unit', row.unit)
        put('minimum_threshold', row.minimum_threshold)
        put('shopping_list_item_id', row.shopping_list_item_id)
        if (row.image) data.append(`items[${index}][image]`, row.image)
      }
    })
    return data
  }

  async function submit(event) {
    event.preventDefault()
    if (saving) return
    const problem = stepProblem(2) || (difference !== 0 && !receipt.difference_reason ? 'Indica il motivo della differenza tra scontrino e righe.' : '')
    if (problem) {
      setShowErrors(true)
      setMessage({ type: 'danger', text: problem })
      return
    }
    setSaving(true)
    setMessage({ type: 'danger', text: '' })
    try {
      const response = await runWithScene('generic', user, () => api.post('/shopping-list/restock-sessions', payload(), { headers: { 'Content-Type': 'multipart/form-data' } }))
      rows.forEach((row) => row.imagePreview && URL.revokeObjectURL(row.imagePreview))
      setRows([])
      setReceipt(emptyReceipt())
      setStep(0)
      setIdempotencyKey(newUuid())
      setMessage({ type: 'success', text: response.status === 200 ? 'Questa spesa era già stata registrata: nessun doppio movimento.' : `Spesa registrata: ${money(receiptTotal)} scalati dalla cassa.` })
      onSaved?.()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      // La chiave resta la stessa: un nuovo tentativo non può creare un doppione.
      setMessage({ type: 'danger', text: errorMessage(error, { itemLabel: (index) => rows[index] && rowLabel(rows[index]) }) })
    } finally { setSaving(false) }
  }

  const fieldId = (row, name) => `${formId}-${row.id}-${name}`

  function renderCostAndPrice(row, errors) {
    const unitCost = unitCostCents(row)
    const sellingCents = toCents(row.selling_price)
    const margin = row.selling_price !== '' && hasCost(row) ? sellingCents - unitCost : null
    return <>
      <fieldset className="restock-fieldset">
        <legend className="form-label">Quanto hai pagato</legend>
        <div className="restock-toggle" role="group" aria-label="Modo di inserimento del costo">
          <button type="button" className={`btn btn-sm ${row.costMode === 'line' ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={row.costMode === 'line'} onClick={() => updateRow(row.id, { costMode: 'line' })}>Totale riga</button>
          <button type="button" className={`btn btn-sm ${row.costMode === 'unit' ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={row.costMode === 'unit'} onClick={() => updateRow(row.id, { costMode: 'unit' })}>A pezzo</button>
        </div>
        {row.costMode === 'line'
          ? <><label className="visually-hidden" htmlFor={fieldId(row, 'line_cost')}>Totale pagato per {rowLabel(row)}</label><input id={fieldId(row, 'line_cost')} className="form-control form-control-lg" inputMode="decimal" placeholder="Totale riga €" value={row.line_cost} onChange={(e) => updateRow(row.id, { line_cost: e.target.value })} /></>
          : <><label className="visually-hidden" htmlFor={fieldId(row, 'unit_cost')}>Costo a pezzo per {rowLabel(row)}</label><input id={fieldId(row, 'unit_cost')} className="form-control form-control-lg" inputMode="decimal" placeholder="Costo a pezzo €" value={row.unit_cost} onChange={(e) => updateRow(row.id, { unit_cost: e.target.value })} /></>}
        <div className="field-help">{hasCost(row) ? `Totale riga ${money(lineCostCents(row))} · ${row.portion_note ? 'a porzione' : 'a pezzo'} ${money(Math.round(unitCost))}` : 'Usa 0 per un omaggio.'}</div>
        {showErrors && errors.cost && <div className="field-error">{errors.cost}</div>}
      </fieldset>

      <div>
        <label className="form-label" htmlFor={fieldId(row, 'selling_price')}>Prezzo di vendita {row.portion_note ? 'a porzione' : 'a pezzo'}{row.kind === 'new' ? '' : ' (facoltativo)'}</label>
        <input id={fieldId(row, 'selling_price')} className="form-control form-control-lg" inputMode="decimal" placeholder={row.currentSellingCents ? `Attuale ${centsToInput(row.currentSellingCents)}` : '€'} value={row.selling_price} onChange={(e) => updateRow(row.id, { selling_price: e.target.value })} />
        {hasCost(row) && rowQuantity(row) > 0 && <div className="restock-suggestions" aria-label="Prezzi suggeriti">
          {MARKUPS.map(([label, multiplier]) => {
            const price = suggestedPrice(unitCost, multiplier)
            return <button type="button" className="btn btn-sm btn-outline-secondary" key={label} onClick={() => updateRow(row.id, { selling_price: centsToInput(price) })}>{label} {money(price)}</button>
          })}
        </div>}
        {margin !== null && <div className={`field-help ${margin < 0 ? 'text-danger fw-bold' : ''}`}>Guadagno {row.portion_note ? 'a porzione' : 'per pezzo'}: {money(Math.round(margin))}</div>}
        {showErrors && errors.selling_price && <div className="field-error">{errors.selling_price}</div>}
      </div>
    </>
  }

  function renderQuantity(row, errors) {
    return <div>
      <label className="form-label" htmlFor={fieldId(row, 'quantity')}>Quantità acquistata{row.unit ? ` (${row.unit})` : ''}</label>
      <div className="quantity-stepper">
        <button type="button" className="btn btn-outline-secondary" aria-label={`Diminuisci quantità di ${rowLabel(row)}`} onClick={() => updateRow(row.id, { quantity: String(Math.max(1, toNumber(row.quantity) - 1)), portion_note: '' })}>−</button>
        <input id={fieldId(row, 'quantity')} className="form-control form-control-lg text-center" inputMode="decimal" value={row.quantity} onChange={(e) => updateRow(row.id, { quantity: e.target.value, portion_note: '' })} />
        <button type="button" className="btn btn-outline-secondary" aria-label={`Aumenta quantità di ${rowLabel(row)}`} onClick={() => updateRow(row.id, { quantity: String(toNumber(row.quantity) + 1), portion_note: '' })}>+</button>
      </div>
      <details className="restock-packages">
        <summary>Calcola da confezioni</summary>
        <div className="restock-two">
          <div><label className="form-label small" htmlFor={fieldId(row, 'packages')}>Confezioni</label><input id={fieldId(row, 'packages')} className="form-control" inputMode="decimal" value={row.package_count} onChange={(e) => { const patch = { package_count: e.target.value, portion_note: '' }; const qty = toNumber(e.target.value) * toNumber(row.pieces_per_package); if (qty > 0) patch.quantity = String(qty); updateRow(row.id, patch) }} /></div>
          <div><label className="form-label small" htmlFor={fieldId(row, 'pieces')}>Pezzi per confezione</label><input id={fieldId(row, 'pieces')} className="form-control" inputMode="decimal" value={row.pieces_per_package} onChange={(e) => { const patch = { pieces_per_package: e.target.value, portion_note: '' }; const qty = toNumber(row.package_count) * toNumber(e.target.value); if (qty > 0) patch.quantity = String(qty); updateRow(row.id, patch) }} /></div>
        </div>
      </details>
      <details className="restock-packages" open={Boolean(row.portion_note)}>
        <summary>Diviso in porzioni (es. busta divisa in bustine)</summary>
        <div className="restock-two">
          <div><label className="form-label small" htmlFor={fieldId(row, 'counted')}>Pezzi contati</label><input id={fieldId(row, 'counted')} className="form-control" inputMode="numeric" placeholder="Es. 37" value={row.portion_pieces || ''} onChange={(e) => applyPortions(row, e.target.value, row.portion_size)} /></div>
          <div><label className="form-label small" htmlFor={fieldId(row, 'portion')}>Pezzi per porzione</label><input id={fieldId(row, 'portion')} className="form-control" inputMode="numeric" placeholder="Es. 5" value={row.portion_size || ''} onChange={(e) => applyPortions(row, row.portion_pieces, e.target.value)} /></div>
        </div>
        {row.portion_note && <div className="summary-box small mt-2">{row.portion_note}. In magazzino entrano <strong>{row.quantity}</strong> {row.kind === 'new' ? row.unit : 'unità'}; il costo si divide sulle porzioni.</div>}
      </details>
      {showErrors && errors.quantity && <div className="field-error">{errors.quantity}</div>}
    </div>
  }

  // Busta contata e divisa in porzioni: in magazzino vanno le porzioni intere, gli avanzi sono omaggio.
  function applyPortions(row, piecesValue, sizeValue) {
    const pieces = Math.floor(toNumber(piecesValue))
    const size = Math.floor(toNumber(sizeValue))
    const patch = { portion_pieces: piecesValue, portion_size: sizeValue }
    if (pieces > 0 && size > 0 && pieces >= size) {
      const portions = Math.floor(pieces / size)
      const leftover = pieces % size
      patch.quantity = String(portions)
      patch.package_count = ''
      patch.pieces_per_package = ''
      patch.portion_note = `${pieces} pezzi in ${portions} porzioni da ${size}${leftover ? `, ${leftover} in omaggio` : ''}`
      if (row.kind === 'new' && row.unit === 'pezzi') patch.unit = 'bustine'
    } else {
      patch.portion_note = ''
    }
    updateRow(row.id, patch)
  }

  function renderRow(row) {
    const errors = rowErrors(row)
    const invalid = showErrors && Object.keys(errors).length > 0
    const removeButton = <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeRow(row.id)} aria-label={`Rimuovi ${rowLabel(row)}`}><Trash2 size={16} /> <span className="d-none d-sm-inline">Rimuovi</span></button>

    if (row.kind === 'expense') {
      return <article className={`app-card restock-card ${invalid ? 'is-invalid' : ''}`} key={row.id} aria-label={rowLabel(row)}>
        <div className="split"><div><StatusBadge tone="neutral">Non magazzino</StatusBadge></div>{removeButton}</div>
        <div>
          <label className="form-label" htmlFor={fieldId(row, 'category')}>Categoria</label>
          <select id={fieldId(row, 'category')} className="form-select form-select-lg" value={row.expense_category} onChange={(e) => updateRow(row.id, { expense_category: e.target.value })}>
            {EXPENSE_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          {showErrors && errors.expense_category && <div className="field-error">{errors.expense_category}</div>}
        </div>
        <div>
          <label className="form-label" htmlFor={fieldId(row, 'description')}>Descrizione (facoltativa)</label>
          <input id={fieldId(row, 'description')} className="form-control" maxLength={255} placeholder="Es. detersivo piatti" value={row.description} onChange={(e) => updateRow(row.id, { description: e.target.value })} />
        </div>
        <div>
          <label className="form-label" htmlFor={fieldId(row, 'line_cost')}>Importo pagato</label>
          <input id={fieldId(row, 'line_cost')} className="form-control form-control-lg" inputMode="decimal" placeholder="€" value={row.line_cost} onChange={(e) => updateRow(row.id, { line_cost: e.target.value })} />
          {showErrors && errors.line_cost && <div className="field-error">{errors.line_cost}</div>}
        </div>
      </article>
    }

    return <article className={`app-card restock-card ${invalid ? 'is-invalid' : ''}`} key={row.id} aria-label={rowLabel(row)}>
      <div className="split align-items-start">
        <div className="min-0">
          {row.kind === 'existing'
            ? <><h3 className="h6 mb-1 text-break">{row.productName}</h3><div className="small text-muted-app">{row.shopping_list_item_id ? 'Dalla lista della spesa · ' : ''}Costo medio {money(row.averageCostCents)} · vendita {money(row.currentSellingCents)}</div></>
            : <StatusBadge tone="primary">{row.shopping_list_item_id ? 'Prodotto nuovo · suggerito' : 'Prodotto nuovo'}</StatusBadge>}
        </div>
        {removeButton}
      </div>

      {row.kind === 'new' && <>
        <div>
          <label className="form-label" htmlFor={fieldId(row, 'name')}>Nome prodotto</label>
          <input id={fieldId(row, 'name')} className="form-control form-control-lg" maxLength={255} value={row.name} onChange={(e) => updateRow(row.id, { name: e.target.value })} />
          {showErrors && errors.name && <div className="field-error">{errors.name}</div>}
        </div>
        <div className="restock-two">
          <div>
            <label className="form-label" htmlFor={fieldId(row, 'cat')}>Categoria</label>
            <select id={fieldId(row, 'cat')} className="form-select" value={row.categoryChoice} onChange={(e) => updateRow(row.id, { categoryChoice: e.target.value })}>
              <option value="">Scegli…</option>
              {categories.map((name) => <option key={name} value={name}>{name}</option>)}
              <option value={NEW_CATEGORY}>+ Nuova categoria…</option>
            </select>
            {row.categoryChoice === NEW_CATEGORY && <><label className="visually-hidden" htmlFor={fieldId(row, 'newcat')}>Nome nuova categoria</label><input id={fieldId(row, 'newcat')} className="form-control mt-2" maxLength={80} placeholder="Nome nuova categoria" value={row.newCategory} onChange={(e) => updateRow(row.id, { newCategory: e.target.value })} autoFocus /></>}
            {showErrors && errors.category && <div className="field-error">{errors.category}</div>}
          </div>
          <div><label className="form-label" htmlFor={fieldId(row, 'unit')}>Unità</label><select id={fieldId(row, 'unit')} className="form-select" value={row.unit} onChange={(e) => updateRow(row.id, { unit: e.target.value })}>{UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></div>
        </div>
        <div><label className="form-label" htmlFor={fieldId(row, 'min')}>Soglia minima (avviso scorta bassa)</label><input id={fieldId(row, 'min')} className="form-control" inputMode="decimal" value={row.minimum_threshold} onChange={(e) => updateRow(row.id, { minimum_threshold: e.target.value })} /></div>
      </>}

      {renderQuantity(row, errors)}
      {renderCostAndPrice(row, errors)}

      {row.kind === 'new' && <div className="restock-photo-row">
        <div className="product-image restock-thumb">{row.imagePreview ? <img src={row.imagePreview} alt={`Anteprima ${row.name || 'prodotto'}`} /> : <span aria-hidden="true">{(row.name || 'N').slice(0, 1)}</span>}</div>
        <div className="stack-sm min-0">
          <label className="btn btn-outline-secondary" htmlFor={fieldId(row, 'image')}><ImagePlus size={17} /> {row.image ? 'Cambia foto' : 'Foto prodotto (facoltativa)'}</label>
          <input id={fieldId(row, 'image')} className="visually-hidden" type="file" accept="image/*" onChange={(e) => { pickProductPhoto(row, e.target.files?.[0]); e.target.value = '' }} />
          {row.image && <button type="button" className="btn btn-sm btn-link text-danger p-0 text-start" onClick={() => { URL.revokeObjectURL(row.imagePreview); updateRow(row.id, { image: null, imagePreview: '' }) }}>Togli foto</button>}
        </div>
      </div>}
    </article>
  }


  return (
    <form className="restock-form" onSubmit={submit} noValidate>
      {waitScene}
      <div className="split mb-3">
        <h2 className="section-title mb-0">Registra spesa</h2>
        <StatusBadge tone="primary">{rows.length} righe</StatusBadge>
      </div>

      <ol className="restock-steps" aria-label="Passaggi">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button type="button" className={`restock-step ${index === step ? 'is-current' : ''} ${index < step ? 'is-done' : ''}`} aria-current={index === step ? 'step' : undefined} onClick={() => goTo(index)}>
              <span className="restock-step-number">{index < step ? <Check size={14} aria-hidden="true" /> : index + 1}</span>{label}
            </button>
          </li>
        ))}
      </ol>

      <div aria-live="polite"><AlertMessage type={message.type}>{message.text}</AlertMessage></div>

      {step === 0 && <section className="app-card stack-md" aria-labelledby={`${formId}-s1`}>
        <h3 className="section-title mb-0" id={`${formId}-s1`}><ReceiptText size={18} aria-hidden="true" /> Scontrino</h3>
        <div className="restock-photo-row">
          <div className="product-image restock-thumb restock-receipt-thumb">{receipt.receipt_preview ? <img src={receipt.receipt_preview} alt="Anteprima scontrino" /> : <ReceiptText size={28} aria-hidden="true" />}</div>
          <div className="stack-sm min-0">
            <label className="btn btn-primary btn-lg" htmlFor={`${formId}-camera`}><Camera size={18} /> {receipt.receipt_image ? 'Rifai foto' : 'Fotografa scontrino'}</label>
            <input id={`${formId}-camera`} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={(e) => { pickReceiptPhoto(e.target.files?.[0]); e.target.value = '' }} />
            <label className="btn btn-outline-secondary" htmlFor={`${formId}-gallery`}><ImagePlus size={17} /> Scegli dalla galleria</label>
            <input id={`${formId}-gallery`} className="visually-hidden" type="file" accept="image/*" onChange={(e) => { pickReceiptPhoto(e.target.files?.[0]); e.target.value = '' }} />
            <div className="field-help">{preparingPhoto ? 'Riduco la foto…' : 'Facoltativa ma consigliata. Viene ridotta automaticamente.'}</div>
          </div>
        </div>
        <div>
          <label className="form-label" htmlFor={`${formId}-total`}>Totale scontrino (€)</label>
          <input id={`${formId}-total`} className="form-control form-control-lg" inputMode="decimal" placeholder="Es. 45,52" value={receipt.total_amount} onChange={(e) => updateReceipt('total_amount', e.target.value)} aria-invalid={showErrors && receiptTotal <= 0} />
        </div>
        <div className="restock-two">
          <div><label className="form-label" htmlFor={`${formId}-date`}>Data</label><input id={`${formId}-date`} className="form-control" type="date" value={receipt.purchased_at} onChange={(e) => updateReceipt('purchased_at', e.target.value)} /></div>
          <div><label className="form-label" htmlFor={`${formId}-time`}>Ora</label><input id={`${formId}-time`} className="form-control" type="time" value={receipt.purchased_time} onChange={(e) => updateReceipt('purchased_time', e.target.value)} /></div>
        </div>
      </section>}

      {step === 1 && <section className="stack-md" aria-labelledby={`${formId}-s2`}>
        <h3 className="visually-hidden" id={`${formId}-s2`}>Prodotti</h3>
        {(openListItems.length > 0 || openReminders.length > 0) && <div className="app-card stack-sm">
          <div className="form-label mb-0"><ListChecks size={17} aria-hidden="true" /> Da comprare</div>
          <div className="restock-chips">
            {openListItems.map((item) => <button type="button" className="btn btn-outline-primary" key={`l-${item.id}`} onClick={() => addFromList(item)}><Plus size={15} /> {item.product?.name || item.suggested_name} · {formatQuantity(item.suggested_quantity)}{item.product ? '' : ' (nuovo)'}</button>)}
            {openReminders.map((product) => <button type="button" className="btn btn-outline-secondary" key={`r-${product.id}`} onClick={() => addExisting(product)}><Plus size={15} /> {product.name} · {Number(product.current_quantity) <= 0 ? 'esaurito' : `ne restano ${formatQuantity(product.current_quantity)}`}</button>)}
          </div>
        </div>}

        <div className="app-card stack-sm">
          <label className="form-label mb-0" htmlFor={`${formId}-search`}>Cerca un prodotto già esistente</label>
          <div className="search-field"><Search size={18} aria-hidden="true" /><input id={`${formId}-search`} className="form-control form-control-lg" type="search" autoComplete="off" placeholder="Es. birra, acqua…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {search && <ul className="restock-results" aria-label="Risultati ricerca">
            {searchResults.map((product) => {
              const used = usedProductIds.has(product.id)
              return <li key={product.id}><button type="button" className="restock-result" disabled={used} onClick={() => addExisting(product)}>
                <span className="min-0 text-break"><strong>{product.name}</strong><span className="d-block small text-muted-app">{formatQuantity(product.current_quantity, product.unit)} · {money(product.selling_price_cents)}</span></span>
                <span className="small">{used ? 'Già inserito' : 'Aggiungi'}</span>
              </button></li>
            })}
            {!searchResults.length && <li className="small text-muted-app p-2">Nessun prodotto con questo nome.</li>}
          </ul>}
          <div className="restock-two">
            <button type="button" className="btn btn-outline-secondary" onClick={() => addNew()}><PackagePlus size={17} /> Prodotto nuovo</button>
            <button type="button" className="btn btn-outline-secondary" onClick={addExpense}><Plus size={17} /> Voce non magazzino</button>
          </div>
        </div>

        {rows.map(renderRow)}
        {!rows.length && <p className="text-muted-app text-center my-3">Nessuna riga ancora. Cerca un prodotto o aggiungine uno nuovo.</p>}
      </section>}

      {step === 2 && <section className="app-card stack-md" aria-labelledby={`${formId}-s3`}>
        <h3 className="section-title mb-0" id={`${formId}-s3`}>Controllo</h3>
        <dl className="restock-summary">
          <div><dt>Prodotti ({productRows.length})</dt><dd className="num">{money(productsTotal)}</dd></div>
          <div><dt>Altre spese ({expenseRows.length})</dt><dd className="num">{money(expensesTotal)}</dd></div>
          <div><dt>Somma righe</dt><dd className="num">{money(productsTotal + expensesTotal)}</dd></div>
          <div className="is-total"><dt>Totale scontrino</dt><dd className="num">{money(receiptTotal)}</dd></div>
          <div className={difference === 0 ? 'is-ok' : 'is-diff'}><dt>Differenza</dt><dd className="num">{money(difference)}</dd></div>
        </dl>
        {expenseRows.length > 0 && <ul className="small text-muted-app mb-0 ps-3">{expenseRows.map((row) => <li key={row.id}>{rowLabel(row)}: {money(lineCostCents(row))}</li>)}</ul>}
        {difference !== 0 && <div>
          <label className="form-label" htmlFor={`${formId}-reason`}>Motivo della differenza</label>
          <select id={`${formId}-reason`} className="form-select form-select-lg" value={receipt.difference_reason} onChange={(e) => updateReceipt('difference_reason', e.target.value)} aria-invalid={showErrors && !receipt.difference_reason}>
            <option value="">Scegli il motivo</option>
            {DIFFERENCE_REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className="field-help">{difference > 0 ? 'Lo scontrino è più alto della somma delle righe.' : 'La somma delle righe supera lo scontrino.'}</div>
        </div>}
        <div>
          <label className="form-label" htmlFor={`${formId}-note`}>Nota (facoltativa)</label>
          <textarea id={`${formId}-note`} className="form-control" rows="2" maxLength={1000} value={receipt.note} onChange={(e) => updateReceipt('note', e.target.value)} />
        </div>
        <p className="small text-muted-app mb-0">La cassa scala solo il totale dello scontrino ({money(receiptTotal)}). I prodotti aggiornano quantità, costo medio e prezzo di vendita.</p>
      </section>}

      <div className="restock-bar">
        <div className="restock-bar-total"><span className="small text-muted-app">Scontrino</span><strong className="num">{money(receiptTotal)}</strong></div>
        {step > 0 && <button type="button" className="btn btn-outline-secondary btn-lg" onClick={() => goTo(step - 1)} aria-label="Passo precedente"><ArrowLeft size={18} /></button>}
        {step < 2
          ? <button type="button" className="btn btn-primary btn-lg" onClick={() => goTo(step + 1)}>Avanti <ArrowRight size={18} /></button>
          : <button type="submit" className="btn btn-success btn-lg" disabled={saving || preparingPhoto}>{saving ? 'Registrazione…' : 'Registra spesa'}</button>}
      </div>
    </form>
  )
}
