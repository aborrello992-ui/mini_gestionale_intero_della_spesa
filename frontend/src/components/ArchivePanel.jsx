import { useEffect, useState } from 'react'
import api from '../api/client'
import AlertMessage from './AlertMessage'
import StatusBadge from './ui/StatusBadge'
import { dateTime, errorMessage, money, quantity } from '../utils/format'

const TYPES = [['cash', 'Cassa'], ['debts', 'Debiti'], ['withdrawals', 'Prelievi'], ['receipts', 'Scontrini']]
const day = (value) => (value ? new Date(value).toLocaleDateString('it-IT') : '-')

function ArchiveRow({ type, row }) {
  if (type === 'debts') return <><div className="split"><strong>{row.member?.name}</strong><strong className="num">{money(row.original_amount_cents)}</strong></div><div className="small text-muted-app">{day(row.created_at)} · pagato {money(row.paid_amount_cents)} · residuo {money(row.remaining_amount_cents)} · {row.status}</div></>
  if (type === 'withdrawals') return <><div className="split"><strong className="text-break">{row.product?.name} · {quantity(row.quantity, row.product?.unit)}</strong><strong className="num">{money(row.total_amount_cents)}</strong></div><div className="small text-muted-app">{row.member?.name} · {dateTime(row.withdrawn_at)} · <StatusBadge status={row.payment_status} /></div></>
  if (type === 'receipts') return <><div className="split"><strong>Scontrino #{row.id}</strong><strong className="num">{money(row.total_cents)}</strong></div><div className="small text-muted-app">{day(row.purchased_at)} · {row.user?.name}</div></>
  return <><div className="split"><strong className="text-break">{row.description}</strong><strong className="num">{row.direction === 'entrata' ? '+' : '−'}{money(row.amount_cents)}</strong></div><div className="small text-muted-app">{day(row.movement_date)} · {row.type?.replaceAll('_', ' ')}{row.member ? ` · ${row.member.name}` : ''}{row.status !== 'active' ? ` · ${row.status}` : ''}</div></>
}

export default function ArchivePanel() {
  const [type, setType] = useState('cash')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/archive?type=${type}&per_page=100`).then(({ data: response }) => { setData(response); setError('') }).catch((err) => setError(errorMessage(err)))
  }, [type])

  return (
    <div className="stack-md">
      <AlertMessage>{error}</AlertMessage>
      <div className="summary-box stack-sm">
        <strong>Archivio conti precedenti (sola lettura)</strong>
        {data?.resets?.length
          ? data.resets.map((reset) => <div className="small" key={reset.id}>Azzeramento al {day(reset.cutoff_date)} · apertura cassa {money(reset.opening_cash_cents)} · eseguito il {dateTime(reset.created_at)}</div>)
          : <div className="small text-muted-app">Nessun azzeramento eseguito.</div>}
        <div className="small text-muted-app">Questi record non contano in saldo, debiti, crediti e contatori.</div>
      </div>
      <div className="cluster" role="group" aria-label="Tipo di record">
        {TYPES.map(([value, label]) => <button type="button" key={value} className={`btn ${type === value ? 'btn-primary' : 'btn-outline-primary'}`} aria-pressed={type === value} onClick={() => setType(value)}>{label}</button>)}
      </div>
      {data?.records?.data?.length
        ? <div className="stack-sm">{data.records.data.map((row) => <div className="app-card stack-sm" key={row.id}><ArchiveRow type={type} row={row} /></div>)}{data.records.total > data.records.data.length && <p className="small text-muted-app">Mostrati {data.records.data.length} di {data.records.total}.</p>}</div>
        : <p className="text-muted-app">Nessun record archiviato.</p>}
    </div>
  )
}
