import { useEffect, useState } from 'react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { errorMessage, money } from '../utils/format'

const movements = [
  ['accredito', 'Accredito'],
  ['quota', 'Quota'],
  ['spesa_generica', 'Spesa generica'],
  ['rimborso', 'Rimborso'],
  ['correzione', 'Correzione'],
  ['altro', 'Altro'],
]

export default function ManagementPage() {
  const [rows, setRows] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    type: 'accredito',
    direction: 'entrata',
    amount: '',
    reason: '',
    movement_date: new Date().toISOString().slice(0, 10),
    movement_time: new Date().toTimeString().slice(0, 5),
  })

  async function load() {
    const { data } = await api.get('/cash/movements?category=gestione&per_page=50')
    setRows(data.data)
  }
  useEffect(() => { load() }, [])

  async function submit(event) {
    event.preventDefault()
    setMessage('')
    try {
      await api.post('/management/movements', form)
      setMessage('Movimento registrato.')
      setForm({ ...form, amount: '', reason: '' })
      load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  return (
    <section>
      <div className="page-title"><h1>Gestione</h1></div>
      <AlertMessage type={message === 'Movimento registrato.' ? 'success' : 'danger'}>{message}</AlertMessage>
      <form className="app-card form-grid mb-3" onSubmit={submit}>
        <select className="form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{movements.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className="form-select" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}><option value="entrata">Entrata</option><option value="uscita">Uscita</option></select>
        <input className="form-control" type="number" step="0.01" placeholder="Importo" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <input className="form-control" type="date" value={form.movement_date} onChange={(e) => setForm({ ...form, movement_date: e.target.value })} />
        <input className="form-control" type="time" value={form.movement_time} onChange={(e) => setForm({ ...form, movement_time: e.target.value })} />
        {form.type === 'altro' && <input className="form-control" placeholder="Motivo del movimento" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />}
        <button className="btn btn-primary">Salva</button>
      </form>
      <div className="app-card table-responsive">
        <table className="table align-middle">
          <thead><tr><th>Data</th><th>Ora</th><th>Movimento</th><th>Entrata</th><th>Uscita</th><th>Registrato da</th><th>Stato</th><th>Azioni</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.id}>
            <td>{new Date(row.movement_date).toLocaleDateString('it-IT')}</td>
            <td>{String(row.movement_time || '').slice(0, 5)}</td>
            <td>{row.description}</td>
            <td>{row.direction === 'entrata' ? `+${money(row.amount_cents)}` : '—'}</td>
            <td>{row.direction === 'uscita' ? `−${money(row.amount_cents)}` : '—'}</td>
            <td>{row.user?.name || '-'}</td>
            <td><span className="badge text-bg-secondary">{row.status}</span></td>
            <td><button className="btn btn-sm btn-outline-secondary" type="button">Dettaglio</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}
