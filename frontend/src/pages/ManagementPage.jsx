import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightLeft, BarChart3, Boxes, FileText, Plus, Receipt, TrendingDown, TrendingUp, UserRound, WalletCards } from 'lucide-react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { dateTime, errorMessage, localDate, money, quantity } from '../utils/format'
import { storageUrl } from '../utils/storage'
import { expenseCategoryLabel } from '../utils/restock'
import PageHeader from '../components/layout/PageHeader'
import MetricCard from '../components/ui/MetricCard'
import DataTable from '../components/tables/DataTable'
import FormField from '../components/forms/FormField'
import StatusBadge from '../components/ui/StatusBadge'
import AppModal from '../components/ui/AppModal'
import WithdrawalReassignPanel from '../components/WithdrawalReassignPanel'

const personalTypes = [['accredito', 'Accredito'], ['quota', 'Quota mensile'], ['rimborso', 'Rimborso'], ['correzione', 'Correzione']]

export default function ManagementPage() {
  const [tab, setTab] = useState('riepilogo')
  const [period, setPeriod] = useState(() => { const today = new Date(); return { from: localDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: localDate(today) } })
  const [summary, setSummary] = useState(null)
  const [members, setMembers] = useState([])
  const [personalRows, setPersonalRows] = useState([])
  const [genericRows, setGenericRows] = useState([])
  const [receipts, setReceipts] = useState([])
  const [receiptDetail, setReceiptDetail] = useState(null)
  const [message, setMessage] = useState('')
  const now = new Date()
  const [personalForm, setPersonalForm] = useState({ type: 'accredito', member_id: '', direction: 'entrata', amount: '', reason: '', movement_date: localDate(now), movement_time: now.toTimeString().slice(0, 5) })
  const [genericForm, setGenericForm] = useState({ type: 'spesa_generica', direction: 'uscita', amount: '', reason: '', movement_date: localDate(now), movement_time: now.toTimeString().slice(0, 5) })

  const loadSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (period.from) params.set('from', period.from)
      if (period.to) params.set('to', period.to)
      setSummary((await api.get(`/management/summary?${params}`)).data)
    } catch (err) { setMessage(errorMessage(err)) }
  }, [period.from, period.to])

  const load = useCallback(async () => {
    const [membersResponse, personal, generic, receiptRows] = await Promise.all([
      api.get('/members'),
      api.get('/cash/movements?category=movimento_personale&per_page=100'),
      api.get('/cash/movements?category=spesa_generica&per_page=100'),
      api.get('/receipts?per_page=100'),
    ])
    setMembers(membersResponse.data)
    setPersonalRows(personal.data.data)
    setGenericRows(generic.data.data)
    setReceipts(receiptRows.data.data)
    loadSummary()
  }, [loadSummary])

  useEffect(() => { load() }, [load])

  async function submitPersonal(event) {
    event.preventDefault()
    setMessage('')
    const type = personalForm.type
    const direction = type === 'rimborso' ? 'uscita' : personalForm.direction
    try {
      await api.post('/management/movements', { ...personalForm, direction })
      setMessage('Movimento personale registrato.')
      setPersonalForm({ ...personalForm, amount: '', reason: '' })
      load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  async function submitGeneric(event) {
    event.preventDefault()
    setMessage('')
    try {
      await api.post('/management/movements', genericForm)
      setMessage('Spesa generica registrata.')
      setGenericForm({ ...genericForm, amount: '', reason: '' })
      load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  async function openReceipt(row) {
    setReceiptDetail((await api.get(`/receipts/${row.id}`)).data)
  }

  const personalColumns = [
    { key: 'date', header: 'Data', render: (row) => new Date(row.movement_date).toLocaleDateString('it-IT') },
    { key: 'time', header: 'Ora', render: (row) => String(row.movement_time || '').slice(0, 5) },
    { key: 'movement', header: 'Movimento', render: (row) => <strong>{row.type?.replaceAll('_', ' ')}</strong> },
    { key: 'person', header: 'Persona', render: (row) => row.member?.name || '-' },
    { key: 'amount', header: 'Importo', align: 'right', render: (row) => `${row.direction === 'entrata' ? '+' : '−'}${money(row.amount_cents)}` },
    { key: 'user', header: 'Registrato da', render: (row) => row.user?.name || '-' },
    { key: 'status', header: 'Stato', render: (row) => <StatusBadge status={row.status}>{row.status === 'active' ? 'Confermato' : row.status}</StatusBadge> },
  ]
  const genericColumns = [
    { key: 'date', header: 'Data', render: (row) => new Date(row.movement_date).toLocaleDateString('it-IT') },
    { key: 'time', header: 'Ora', render: (row) => String(row.movement_time || '').slice(0, 5) },
    { key: 'direction', header: 'Entrata/Uscita', render: (row) => <StatusBadge status={row.direction}>{row.direction}</StatusBadge> },
    { key: 'amount', header: 'Importo', align: 'right', render: (row) => `${row.direction === 'entrata' ? '+' : '−'}${money(row.amount_cents)}` },
    { key: 'user', header: 'Registrato da', render: (row) => row.user?.name || '-' },
    { key: 'status', header: 'Stato', render: (row) => <StatusBadge status={row.status}>{row.status}</StatusBadge> },
  ]
  const receiptColumns = [
    { key: 'date', header: 'Data', render: (row) => `${new Date(row.purchased_at).toLocaleDateString('it-IT')} ${String(row.purchased_time || '').slice(0, 5)}` },
    { key: 'total', header: 'Totale', align: 'right', render: (row) => money(row.total_cents) },
    { key: 'photo', header: 'Foto', render: (row) => row.receipt_image_path ? <a className="btn btn-sm btn-outline-primary" href={storageUrl(row.receipt_image_path)} target="_blank">Visualizza</a> : <StatusBadge tone="neutral">Assente</StatusBadge> },
    { key: 'items', header: 'Prodotti acquistati', render: (row) => <div><strong>{row.items_count} righe</strong><div className="small text-muted-app">{quantity(row.total_quantity || 0, 'pezzi')}</div></div> },
    { key: 'user', header: 'Registrato da', render: (row) => row.user?.name || '-' },
    { key: 'status', header: 'Stato', render: (row) => <StatusBadge tone="success">{row.status || 'Registrato'}</StatusBadge> },
    { key: 'actions', header: 'Azioni', render: (row) => <button className="btn btn-sm btn-outline-primary" onClick={() => openReceipt(row)}>Vedi dettaglio</button> },
  ]

  const activeRows = useMemo(() => tab === 'personali' ? personalRows : tab === 'generiche' ? genericRows : receipts, [tab, personalRows, genericRows, receipts])

  return (
    <section>
      <PageHeader title="Gestione" subtitle="Movimenti personali, spese generiche e registro scontrini sono separati per non confondere la cassa." />
      <AlertMessage type={message.includes('registrat') ? 'success' : 'danger'}>{message}</AlertMessage>
      <div className="app-card filter-bar mb-3">
        <FormField label="Dal" htmlFor="summary-from"><input id="summary-from" className="form-control" type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} /></FormField>
        <FormField label="Al" htmlFor="summary-to"><input id="summary-to" className="form-control" type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} /></FormField>
      </div>
      <div className="metric-grid mb-3">
        <MetricCard emphasis icon={WalletCards} label="Saldo attuale" value={money(summary?.balance_cents || 0)} help="Calcolato sul server da tutti i movimenti validi." />
        <MetricCard icon={TrendingUp} tone="success" label="Entrate periodo" value={money(summary?.cash.income_cents || 0)} help="Movimenti attivi, esclusi gli annullati." />
        <MetricCard icon={TrendingDown} tone="danger" label="Uscite periodo" value={money(summary?.cash.outcome_cents || 0)} help="Comprese le spese da scontrino." />
        <MetricCard icon={UserRound} tone="warning" label="Copponi aperti" value={money(summary?.open_coppone_cents || 0)} help="Debiti ancora da saldare." />
        <MetricCard icon={Boxes} tone="info" label="Magazzino a costo" value={money(summary?.inventory.value_at_cost_cents || 0)} help={`A prezzo di vendita: ${money(summary?.inventory.value_at_price_cents || 0)}`} />
        <MetricCard icon={Receipt} tone="info" label="Scontrini periodo" value={summary?.receipts.count || 0} help={`${summary?.receipts.lines || 0} righe · ${money(summary?.receipts.total_cents || 0)}`} />
      </div>
      <div className="cluster mb-3">
        <button className={`btn ${tab === 'riepilogo' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab('riepilogo')}><BarChart3 size={17} /> Riepilogo</button>
        <button className={`btn ${tab === 'personali' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab('personali')}><UserRound size={17} /> Movimenti personali</button>
        <button className={`btn ${tab === 'generiche' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab('generiche')}><WalletCards size={17} /> Spese generiche</button>
        <button className={`btn ${tab === 'scontrini' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab('scontrini')}><FileText size={17} /> Registro scontrini</button>
        <button className={`btn ${tab === 'prelievi' ? 'btn-primary' : 'btn-outline-primary'}`} onClick={() => setTab('prelievi')}><ArrowRightLeft size={17} /> Riassegna prelievi</button>
      </div>

      {tab === 'riepilogo' && summary && <div className="card-grid mb-3">
        <div className="app-card stack-sm">
          <h2 className="h6 mb-1">Cassa del periodo per tipo</h2>
          {summary.cash.by_type.length ? summary.cash.by_type.map((row) => <div className="split" key={row.type}><span>{row.label}</span><span className="num">{row.income_cents ? `+${money(row.income_cents)}` : ''} {row.outcome_cents ? `−${money(row.outcome_cents)}` : ''}</span></div>) : <p className="text-muted-app mb-0">Nessun movimento nel periodo.</p>}
        </div>
        <div className="app-card stack-sm">
          <h2 className="h6 mb-1">Spese da scontrino</h2>
          <div className="split"><span>Prodotti</span><strong className="num">{money(summary.receipts.products_cents)}</strong></div>
          <div className="split"><span>Altre spese</span><strong className="num">{money(summary.receipts.expenses_cents)}</strong></div>
          {Object.entries(summary.receipts.expenses_by_category || {}).map(([category, cents]) => <div className="split small text-muted-app ps-2" key={category}><span>{expenseCategoryLabel(category)}</span><span className="num">{money(cents)}</span></div>)}
          <div className="split"><span>Differenze scontrino</span><strong className="num">{money(summary.receipts.difference_cents)}</strong></div>
        </div>
        <div className="app-card stack-sm">
          <h2 className="h6 mb-1">Soci</h2>
          {summary.members.map((member) => <div className="split" key={member.id}><span className="min-0 text-truncate">{member.name}</span><span className="num small">{member.open_coppone_cents ? <span className="text-danger">debito {money(member.open_coppone_cents)}</span> : null}{member.wallet_credit_cents ? <span className="text-success ms-2">credito {money(member.wallet_credit_cents)}</span> : null}{!member.open_coppone_cents && !member.wallet_credit_cents ? 'in pari' : null}</span></div>)}
        </div>
      </div>}

      {tab === 'personali' && <>
        <form className="app-card form-grid mb-3" onSubmit={submitPersonal}>
          <FormField label="Movimento"><select className="form-select" value={personalForm.type} onChange={(e) => setPersonalForm({ ...personalForm, type: e.target.value })}>{personalTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></FormField>
          <FormField label="Persona"><select className="form-select" value={personalForm.member_id} onChange={(e) => setPersonalForm({ ...personalForm, member_id: e.target.value })} required><option value="">Scegli persona</option>{members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></FormField>
          {personalForm.type === 'correzione' && <FormField label="Entrata/Uscita"><select className="form-select" value={personalForm.direction} onChange={(e) => setPersonalForm({ ...personalForm, direction: e.target.value })}><option value="entrata">Entrata</option><option value="uscita">Uscita</option></select></FormField>}
          <FormField label="Importo"><input className="form-control" type="number" step="0.01" min="0.01" value={personalForm.amount} onChange={(e) => setPersonalForm({ ...personalForm, amount: e.target.value })} required /></FormField>
          <FormField label="Data"><input className="form-control" type="date" value={personalForm.movement_date} onChange={(e) => setPersonalForm({ ...personalForm, movement_date: e.target.value })} required /></FormField>
          <FormField label="Ora"><input className="form-control" type="time" value={personalForm.movement_time} onChange={(e) => setPersonalForm({ ...personalForm, movement_time: e.target.value })} required /></FormField>
          {personalForm.type === 'correzione' && <FormField label="Motivo breve"><input className="form-control" value={personalForm.reason} onChange={(e) => setPersonalForm({ ...personalForm, reason: e.target.value })} /></FormField>}
          <button className="btn btn-primary"><Plus size={17} /> Salva</button>
        </form>
        <DataTable columns={personalColumns} rows={personalRows} getKey={(row) => row.id} emptyTitle="Nessun movimento personale" renderMobile={(row) => <><div className="split"><strong>{row.type}</strong><strong>{money(row.amount_cents)}</strong></div><div className="small text-muted-app">{row.member?.name} · {dateTime(`${row.movement_date}T${row.movement_time || '00:00'}`)}</div></>} />
      </>}

      {tab === 'generiche' && <>
        <form className="app-card form-grid mb-3" onSubmit={submitGeneric}>
          <FormField label="Entrata/Uscita"><select className="form-select" value={genericForm.direction} onChange={(e) => setGenericForm({ ...genericForm, direction: e.target.value })}><option value="entrata">Entrata generica</option><option value="uscita">Uscita generica</option></select></FormField>
          <FormField label="Importo"><input className="form-control" type="number" step="0.01" min="0.01" value={genericForm.amount} onChange={(e) => setGenericForm({ ...genericForm, amount: e.target.value })} required /></FormField>
          <FormField label="Data"><input className="form-control" type="date" value={genericForm.movement_date} onChange={(e) => setGenericForm({ ...genericForm, movement_date: e.target.value })} required /></FormField>
          <FormField label="Ora"><input className="form-control" type="time" value={genericForm.movement_time} onChange={(e) => setGenericForm({ ...genericForm, movement_time: e.target.value })} required /></FormField>
          <FormField label="Motivo facoltativo"><input className="form-control" value={genericForm.reason} onChange={(e) => setGenericForm({ ...genericForm, reason: e.target.value })} /></FormField>
          <button className="btn btn-primary"><Plus size={17} /> Salva</button>
        </form>
        <DataTable columns={genericColumns} rows={genericRows} getKey={(row) => row.id} emptyTitle="Nessuna spesa generica" renderMobile={(row) => <><div className="split"><StatusBadge status={row.direction}>{row.direction}</StatusBadge><strong>{money(row.amount_cents)}</strong></div><div className="small text-muted-app">{dateTime(`${row.movement_date}T${row.movement_time || '00:00'}`)} · {row.user?.name}</div></>} />
      </>}

      {tab === 'scontrini' && <DataTable columns={receiptColumns} rows={activeRows} getKey={(row) => row.id} emptyTitle="Nessuno scontrino registrato" emptyMessage="Gli scontrini si registrano dalla Lista spesa." renderMobile={(row) => <><div className="split"><strong>{money(row.total_cents)}</strong><StatusBadge tone="success">{row.status}</StatusBadge></div><div className="small text-muted-app">{new Date(row.purchased_at).toLocaleDateString('it-IT')} · {row.items_count} prodotti</div><button className="btn btn-outline-primary" onClick={() => openReceipt(row)}>Vedi dettaglio</button></>} />}

      {tab === 'prelievi' && <WithdrawalReassignPanel members={members} onChanged={loadSummary} />}

      {receiptDetail && <AppModal title="Dettaglio scontrino" subtitle={`${new Date(receiptDetail.purchased_at).toLocaleDateString('it-IT')} · ${money(receiptDetail.total_cents)}`} onClose={() => setReceiptDetail(null)}>
        <div className="stack-md">
          <div className="summary-box">
            <div className="split"><span>Totale scontrino</span><strong>{money(receiptDetail.total_cents)}</strong></div>
            <div className="split"><span>Differenza righe</span><strong>{money(receiptDetail.difference_cents || 0)}</strong></div>
            {receiptDetail.difference_reason && <div className="small text-muted-app">Motivo: {receiptDetail.difference_reason.replaceAll('_', ' ')}</div>}
            <div className="small text-muted-app">Registrato da {receiptDetail.user?.name || '-'} · stato {receiptDetail.status}</div>
          </div>
          {receiptDetail.receipt_image_path && <a className="btn btn-outline-primary" href={storageUrl(receiptDetail.receipt_image_path)} target="_blank">Visualizza foto scontrino</a>}
          {receiptDetail.items.map((item) => {
            if (item.item_type === 'expense') {
              return <div className="list-row" key={item.id}>
                <div className="split"><strong>{expenseCategoryLabel(item.expense_category)}</strong><StatusBadge tone="neutral">Non magazzino</StatusBadge></div>
                <div className="small text-muted-app">{item.description || 'Senza descrizione'} · importo {money(item.cost_cents || 0)}</div>
              </div>
            }
            const margin = Number(item.product?.selling_price_cents || item.selling_price_cents || 0) - Number(item.unit_cost_cents || 0)
            const previousQty = Number(item.product?.current_quantity || 0) - Number(item.quantity || 0)
            return <div className="list-row" key={item.id}>
              <div className="split"><strong>{item.product?.name}</strong><StatusBadge tone="info">{quantity(item.quantity, item.product?.unit)}</StatusBadge></div>
              <div className="small text-muted-app">Costo unitario {money(item.unit_cost_cents || 0)} · totale riga {money(item.cost_cents || 0)} · prezzo vendita {money(item.product?.selling_price_cents || item.selling_price_cents || 0)} · margine {money(margin)}</div>
              <div className="small text-muted-app">Quantità: {previousQty.toFixed(3)} → {item.product?.current_quantity}</div>
            </div>
          })}
        </div>
      </AppModal>}
    </section>
  )
}
