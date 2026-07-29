import { useEffect, useState } from 'react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { useAuth } from '../hooks/useAuth'
import { errorMessage, money } from '../utils/format'

export default function CashPage() {
  const { isAdmin } = useAuth()
  const [balance, setBalance] = useState(0)
  const [rows, setRows] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ amount: '', direction: 'entrata', type: 'versamento', description: '', movement_date: new Date().toISOString().slice(0, 10) })
  async function load() {
    const [b, m] = await Promise.all([api.get('/cash/balance'), api.get('/cash/movements')])
    setBalance(b.data.balance_cents); setRows(m.data.data)
  }
  useEffect(() => { load() }, [])
  async function submit(event) {
    event.preventDefault()
    try { await api.post('/cash/movements', form); setMessage('Movimento registrato.'); load() } catch (err) { setMessage(errorMessage(err)) }
  }
  return (
    <section>
      <div className="page-title"><h1>Cassa</h1><strong className="balance">{money(balance)}</strong></div>
      <AlertMessage type={message === 'Movimento registrato.' ? 'success' : 'danger'}>{message}</AlertMessage>
      {isAdmin && <form className="app-card form-grid mb-3" onSubmit={submit}>
        <input className="form-control" type="number" step="0.01" placeholder="Importo" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <select className="form-select" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}><option>entrata</option><option>uscita</option></select>
        <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{['versamento', 'altra_spesa', 'rimborso', 'correzione'].map((t) => <option key={t}>{t}</option>)}</select>
        <input className="form-control" placeholder="Descrizione" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input className="form-control" type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} />
        <button className="btn btn-primary">Salva</button>
      </form>}
      <div className="app-card">{rows.map((m) => <div className="list-row" key={m.id}><strong>{money(m.amount_cents)}</strong> · {m.direction} · {m.description}</div>)}</div>
    </section>
  )
}
