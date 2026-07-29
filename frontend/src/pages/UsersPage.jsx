import { useEffect, useState } from 'react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { errorMessage } from '../utils/format'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({ name: '', email: '', password: 'password', role: 'member', is_active: true })
  async function load() { setUsers((await api.get('/users')).data) }
  useEffect(() => { load() }, [])
  async function submit(event) {
    event.preventDefault()
    try { await api.post('/users', form); setMessage('Utente creato.'); load() } catch (err) { setMessage(errorMessage(err)) }
  }
  return (
    <section>
      <div className="page-title"><h1>Utenti</h1></div>
      <AlertMessage type={message === 'Utente creato.' ? 'success' : 'danger'}>{message}</AlertMessage>
      <form className="app-card form-grid mb-3" onSubmit={submit}>
        <input className="form-control" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="form-control" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="form-control" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="member">membro</option><option value="admin">admin</option></select>
        <button className="btn btn-primary">Crea</button>
      </form>
      <div className="app-card">{users.map((user) => <div className="list-row" key={user.id}>{user.name} · {user.email} · {user.role} · {user.is_active ? 'attivo' : 'disattivo'}</div>)}</div>
    </section>
  )
}
