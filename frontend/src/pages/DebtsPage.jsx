import { useEffect, useState } from 'react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import Loading from '../components/Loading'
import { dateTime, errorMessage, money, quantity } from '../utils/format'
import { useAuth } from '../hooks/useAuth'

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
  return (
    <section>
      <div className="page-title"><h1>Debiti</h1></div>
      <AlertMessage type={message === 'Pagamento registrato.' ? 'success' : 'danger'}>{message}</AlertMessage>
      <div className="card-grid">
        {debtors.map((member) => (
          <button className="app-card debtor-card text-start" key={member.id} onClick={() => open(member)}>
            <div className="avatar">{member.name.slice(0, 1)}</div>
            <h2 className="h5">{member.name}</h2>
            <strong>{money(member.open_debt_cents)}</strong>
            <div className="small text-secondary">{member.open_debts_count} voci · ultimo {dateTime(member.last_debt_at)}</div>
          </button>
        ))}
      </div>
      {!debtors.length && <div className="app-card text-secondary">Nessun coppone aperto.</div>}
      {detail && <div className="app-card mt-3">
        <div className="page-title"><h2 className="h4">{detail.member.name}</h2><strong>{money(detail.remaining_cents)}</strong></div>
        {detail.items.map((debt) => {
          const product = debt.withdrawal?.product
          return <div className="list-row" key={debt.id}>
            <strong>{product?.name || debt.description || 'Debito pregresso'}</strong>
            {product ? ` · ${quantity(debt.withdrawal.quantity, product.unit)} · ${money(debt.withdrawal.unit_price_cents)} cad.` : ''}
            {' '}· residuo {money(debt.remaining_amount_cents)}
            <div className="small text-secondary">{dateTime(debt.withdrawal?.withdrawn_at || debt.created_at)} · {debt.withdrawal?.notes || debt.notes || 'nessuna nota'} · {debt.type}</div>
          </div>
        })}
        {isAdmin && detail.remaining_cents > 0 && <form className="form-grid mt-3" onSubmit={pay}>
          <input className="form-control" type="number" step="0.01" min="0.01" max={detail.remaining_cents / 100} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Importo saldato" />
          <button className="btn btn-primary">Registra pagamento</button>
        </form>}
      </div>}
    </section>
  )
}
