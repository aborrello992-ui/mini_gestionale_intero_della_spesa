import { useEffect, useState } from 'react'
import { HandCoins } from 'lucide-react'
import api from '../api/client'
import AppModal from './ui/AppModal'
import { dateTime, money } from '../utils/format'
import { useAuth } from '../hooks/useAuth'

const SEEN_KEY = 'loan_reminder_seen'

/** Promemoria a ogni accesso per chi ha preso dei soldi dalla cassa e non li ha ancora restituiti. */
export default function LoanReminder() {
  const { user, isPersonal, isGuest } = useAuth()
  const userId = user?.id
  const [loans, setLoans] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!userId || !isPersonal || isGuest) return undefined
    let cancelled = false
    api.get('/cash-loans/mine').then(({ data }) => {
      if (cancelled || !data.length) return
      setLoans(data)
      let seen = false
      try { seen = sessionStorage.getItem(SEEN_KEY) === String(userId) } catch { /* senza storage il promemoria compare sempre */ }
      if (!seen) setOpen(true)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [userId, isPersonal, isGuest])

  function close() {
    try { sessionStorage.setItem(SEEN_KEY, String(userId)) } catch { /* ignora */ }
    setOpen(false)
  }

  if (!open || !loans.length) return null
  const total = loans.reduce((sum, loan) => sum + Number(loan.amount_cents) - Number(loan.repaid_cents), 0)

  return (
    <AppModal title="Amico caro…" subtitle="Promemoria dalla cassa" onClose={close} labelledBy="loan-reminder-title">
      <div className="stack-md">
        <p className="h5 mb-0"><HandCoins size={20} aria-hidden="true" /> Non voglio insistere, ma restituisci il bottino.</p>
        <div className="summary-box stack-sm">
          <div className="split"><span>Da rimettere in cassa</span><strong className="num">{money(total)}</strong></div>
          {loans.map((loan) => <div className="small text-muted-app" key={loan.id}>{money(Number(loan.amount_cents) - Number(loan.repaid_cents))} · presi il {dateTime(loan.borrowed_at)}{loan.note ? ` · ${loan.note}` : ''}</div>)}
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={close} autoFocus>Ricevuto, ci penso</button>
      </div>
    </AppModal>
  )
}
