import { useEffect, useState } from 'react'
import { CreditCard, ReceiptText, Users, WalletCards } from 'lucide-react'
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
  const [paymentForms, setPaymentForms] = useState({})
  const [payingMemberId, setPayingMemberId] = useState(null)
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
    if (payingMemberId) return
    setMessage('')
    setPayingMemberId(detail.member.id)
    try {
      await api.post(`/debts/${detail.member.id}/payments`, { amount })
      setMessage('Movimento registrato.')
      setAmount('')
      await open(detail.member)
      await load()
    } catch (err) { setMessage(errorMessage(err)) } finally { setPayingMemberId(null) }
  }

  async function payFromCard(event, member) {
    event.preventDefault()
    event.stopPropagation()
    if (payingMemberId) return
    const cardAmount = paymentForms[member.id] || ''
    setMessage('')
    setPayingMemberId(member.id)
    try {
      await api.post(`/debts/${member.id}/payments`, { amount: cardAmount })
      setMessage('Movimento registrato.')
      setPaymentForms({ ...paymentForms, [member.id]: '' })
      if (detail?.member?.id === member.id) await open(member)
      await load()
    } catch (err) { setMessage(errorMessage(err)) } finally { setPayingMemberId(null) }
  }

  if (!debtors) return <Loading />
  const totalDebt = debtors.reduce((sum, member) => sum + Number(member.open_debt_cents || 0), 0)
  const totalWallet = debtors.reduce((sum, member) => sum + Number(member.wallet_credit_cents || 0), 0)
  const debtorCount = debtors.filter((member) => Number(member.open_debt_cents || 0) > 0).length
  const lastMovement = debtors.map((member) => member.last_debt_at).filter(Boolean).sort().at(-1)

  return (
    <section>
      <PageHeader title="Debiti" subtitle="Debiti aperti e accrediti personali lasciati in cassa." />
      <AlertMessage type={message === 'Movimento registrato.' ? 'success' : 'danger'}>{message}</AlertMessage>
      <div className="metric-grid mb-3">
        <MetricCard emphasis icon={ReceiptText} tone="warning" label="Totale da incassare" value={money(totalDebt)} help="Non è incluso nel saldo reale della cassa." />
        <MetricCard icon={WalletCards} tone="success" label="Portafogli" value={money(totalWallet)} help="Accrediti personali già lasciati in cassa." />
        <MetricCard icon={Users} tone="info" label="Persone debitrici" value={debtorCount} help="Utenti con debito ancora aperto." />
        <MetricCard icon={CreditCard} tone="success" label="Ultimo coppone" value={lastMovement ? dateTime(lastMovement) : '—'} help="Movimento più recente registrato." />
      </div>
      <div className="card-grid">
        {debtors.map((member) => {
          const openDebt = Number(member.open_debt_cents || 0)
          const walletCredit = Number(member.wallet_credit_cents || 0)
          return (
          <article className="app-card debtor-card stack-md" key={member.id}>
            <div className="split">
              <div className="cluster">
                <UserAvatar name={member.name} />
                <div><h2 className="h5 mb-0">{member.name}</h2><div className="small text-muted-app">{openDebt > 0 ? `${member.open_debts_count} voci non saldate` : 'Nessun debito aperto'}</div></div>
              </div>
              {openDebt > 0 ? <StatusBadge status="coppone">Coppone</StatusBadge> : <StatusBadge tone="success">Pulito</StatusBadge>}
            </div>
            <div className="wallet-summary">
              <div><span>Debito</span><strong className="num">{money(openDebt)}</strong></div>
              <div><span>Credito</span><strong className="num">{money(walletCredit)}</strong></div>
            </div>
            <div className="small text-muted-app">Ultimo movimento: {openDebt > 0 ? dateTime(member.last_debt_at) : '—'}</div>
            {isAdmin && <form className="stack-sm" onSubmit={(event) => payFromCard(event, member)}>
              <FormField label="Importo versato" help={openDebt > 0 ? `Scala il debito; oltre ${money(openDebt)} diventa accredito.` : 'Viene registrato come accredito personale.'}>
                <input className="form-control" type="number" step="0.01" min="0.01" value={paymentForms[member.id] || ''} onChange={(e) => setPaymentForms({ ...paymentForms, [member.id]: e.target.value })} />
              </FormField>
              <button className="btn btn-primary w-100" disabled={payingMemberId === member.id}>
                {payingMemberId === member.id ? 'Registrazione...' : 'Registra versamento'}
              </button>
            </form>}
            <button type="button" className="btn btn-outline-primary w-100" onClick={() => open(member)}>Vedi dettaglio</button>
          </article>
        )})}
      </div>
      {!debtors.length && <EmptyState title="Nessuna persona disponibile" message="Aggiungi utenti attivi per gestire debiti e accrediti." />}
      {detail && <div className="app-card mt-3">
        <div className="split mb-3">
          <div className="cluster"><UserAvatar name={detail.member.name} /><div><h2 className="h4 mb-0">{detail.member.name}</h2><div className="text-muted-app">Dettaglio copponi e portafoglio</div></div></div>
          <div className="text-end"><strong className="h3 mb-0 num">{money(detail.remaining_cents)}</strong><div className="small text-muted-app">Credito: {money(detail.member.wallet_credit_cents || 0)}</div></div>
        </div>
        {!detail.items.length && <EmptyState title="Nessun debito aperto" message="Puoi comunque registrare un versamento come accredito personale." />}
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
        {isAdmin && <form className="form-grid mt-3" onSubmit={pay}>
          <FormField label="Importo versato" help={detail.remaining_cents > 0 ? `Scala il debito; oltre ${money(detail.remaining_cents)} diventa accredito.` : 'Viene registrato come accredito personale.'}>
            <input className="form-control" type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </FormField>
          <button className="btn btn-primary" disabled={payingMemberId === detail.member.id}>{payingMemberId === detail.member.id ? 'Registrazione...' : 'Registra versamento'}</button>
        </form>}
      </div>}
    </section>
  )
}
