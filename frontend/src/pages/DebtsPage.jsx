import { useEffect, useState } from 'react'
import { CreditCard, ReceiptText, Users } from 'lucide-react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import Loading from '../components/Loading'
import { dateTime, errorMessage, money, quantity } from '../utils/format'
import { useAuth } from '../hooks/useAuth'
import PageHeader from '../components/layout/PageHeader'
import MetricCard from '../components/ui/MetricCard'
import EmptyState from '../components/feedback/EmptyState'
import FormField from '../components/forms/FormField'
import UserAvatar from '../components/ui/UserAvatar'
import StatusBadge from '../components/ui/StatusBadge'

export default function DebtsPage() {
  const { isAdmin } = useAuth()
  const [debtors, setDebtors] = useState(null)
  const [detail, setDetail] = useState(null)
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setDebtors((await api.get('/debts')).data)
  }
  useEffect(() => { load() }, [])

  async function open(member) {
    setDetail((await api.get(`/debts/${member.id}`)).data)
  }

  async function pay(event) {
    event.preventDefault()
    setMessage('')
    try {
      await api.post(`/debts/${detail.member.id}/payments`, { amount })
      setMessage('Pagamento registrato.')
      setAmount('')
      await open(detail.member)
      await load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  if (!debtors) return <Loading />
  const totalDebt = debtors.reduce((sum, member) => sum + Number(member.open_debt_cents || 0), 0)
  const lastMovement = debtors.map((member) => member.last_debt_at).filter(Boolean).sort().at(-1)

  return (
    <section>
      <PageHeader title="Debiti" subtitle="Persone con copponi aperti e importi ancora da incassare." />
      <AlertMessage type={message === 'Pagamento registrato.' ? 'success' : 'danger'}>{message}</AlertMessage>
      <div className="metric-grid mb-3">
        <MetricCard emphasis icon={ReceiptText} tone="warning" label="Totale da incassare" value={money(totalDebt)} help="Non è incluso nel saldo reale della cassa." />
        <MetricCard icon={Users} tone="info" label="Persone debitrici" value={debtors.length} help="Solo utenti con debito aperto." />
        <MetricCard icon={CreditCard} tone="success" label="Ultimo coppone" value={lastMovement ? dateTime(lastMovement) : '—'} help="Movimento più recente registrato." />
      </div>
      <div className="card-grid">
        {debtors.map((member) => (
          <button className="app-card debtor-card stack-md" key={member.id} onClick={() => open(member)}>
            <div className="split">
              <div className="cluster">
                <UserAvatar name={member.name} />
                <div><h2 className="h5 mb-0">{member.name}</h2><div className="small text-muted-app">{member.open_debts_count} voci non saldate</div></div>
              </div>
              <StatusBadge status="coppone">Coppone</StatusBadge>
            </div>
            <strong className="metric-value num">{money(member.open_debt_cents)}</strong>
            <div className="small text-muted-app">Ultimo movimento: {dateTime(member.last_debt_at)}</div>
            <span className="btn btn-outline-primary w-100">Vedi dettaglio</span>
          </button>
        ))}
      </div>
      {!debtors.length && <EmptyState title="Nessun debito aperto" message="Tutti hanno saldato. Bella schermata da vedere vuota." />}
      {detail && <div className="app-card mt-3">
        <div className="split mb-3">
          <div className="cluster"><UserAvatar name={detail.member.name} /><div><h2 className="h4 mb-0">{detail.member.name}</h2><div className="text-muted-app">Dettaglio copponi aperti</div></div></div>
          <strong className="h3 mb-0 num">{money(detail.remaining_cents)}</strong>
        </div>
        {detail.items.map((debt) => {
          const product = debt.withdrawal?.product
          return <div className="list-row" key={debt.id}>
            <div className="split">
              <div>
                <strong>{product?.name || debt.description || 'Debito pregresso'}</strong>
                <div className="small text-muted-app">{product ? `${quantity(debt.withdrawal.quantity, product.unit)} · ${money(debt.withdrawal.unit_price_cents)} cad.` : debt.type}</div>
              </div>
              <strong className="num">{money(debt.remaining_amount_cents)}</strong>
            </div>
            <div className="small text-muted-app mt-2">{dateTime(debt.withdrawal?.withdrawn_at || debt.created_at)} · {debt.withdrawal?.notes || debt.notes || 'nessuna nota'}</div>
          </div>
        })}
        {isAdmin && detail.remaining_cents > 0 && <form className="form-grid mt-3" onSubmit={pay}>
          <FormField label="Importo saldato" help={`Massimo ${money(detail.remaining_cents)}`}>
            <input className="form-control" type="number" step="0.01" min="0.01" max={detail.remaining_cents / 100} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
          <button className="btn btn-primary">Registra pagamento</button>
        </form>}
      </div>}
    </section>
  )
}
