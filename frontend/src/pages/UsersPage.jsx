import { useEffect, useState } from 'react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { errorMessage } from '../utils/format'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [message, setMessage] = useState('')
  const [pinEdit, setPinEdit] = useState(null)
  const [pin, setPin] = useState({ pin: '', pin_confirmation: '' })
  const [form, setForm] = useState({ name: '', aliases: '', email: '', password: 'password', role: 'member', pin: '123', is_active: true })

  async function load() { setUsers((await api.get('/users')).data) }
  useEffect(() => { load() }, [])

  async function submit(event) {
    event.preventDefault()
    try {
      await api.post('/users', { ...form, aliases: form.aliases ? form.aliases.split(',').map((value) => value.trim()).filter(Boolean) : [] })
      setMessage('Utente creato.')
      load()
    } catch (err) { setMessage(errorMessage(err)) }
  }

  async function updatePin(event) {
    event.preventDefault()
    try {
      await api.put(`/users/${pinEdit.id}/pin`, pin)
      setMessage('PIN aggiornato correttamente.')
      setPinEdit(null)
      setPin({ pin: '', pin_confirmation: '' })
    } catch (err) { setMessage(errorMessage(err)) }
  }

  return (
    <section>
      <div className="page-title"><h1>Utenti</h1></div>
      <AlertMessage type={['Utente creato.', 'PIN aggiornato correttamente.'].includes(message) ? 'success' : 'danger'}>{message}</AlertMessage>
      <form className="app-card form-grid mb-3" onSubmit={submit}>
        <input className="form-control" placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input className="form-control" placeholder="Alias separati da virgola" value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} />
        <input className="form-control" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input className="form-control" placeholder="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <input className="form-control" placeholder="PIN 3 cifre" inputMode="numeric" maxLength="3" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
        <select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="member">membro</option><option value="admin">admin</option></select>
        <button className="btn btn-primary">Crea</button>
      </form>
      <div className="app-card table-responsive">
        <table className="table align-middle">
          <thead><tr><th>Nome</th><th>Alias</th><th>Ruolo</th><th>Stato</th><th>Creato</th><th>Azioni</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id}>
            <td>{user.name}</td>
            <td>{(user.aliases || []).join(', ') || '-'}</td>
            <td>{user.role}</td>
            <td>{user.is_active ? 'attivo' : 'disattivo'}</td>
            <td>{new Date(user.created_at).toLocaleDateString('it-IT')}</td>
            <td><button className="btn btn-sm btn-outline-primary" onClick={() => setPinEdit(user)}>Modifica PIN</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      {pinEdit && <div className="modal-backdrop-lite" role="dialog" aria-modal="true">
        <form className="take-panel" onSubmit={updatePin}>
          <button className="btn-close float-end" type="button" onClick={() => setPinEdit(null)} aria-label="Chiudi" />
          <h2 className="h4">Modifica PIN di {pinEdit.name}</h2>
          <input className="form-control form-control-lg mb-3 pin-input" placeholder="Nuovo PIN" inputMode="numeric" maxLength="3" value={pin.pin} onChange={(e) => setPin({ ...pin, pin: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
          <input className="form-control form-control-lg mb-3 pin-input" placeholder="Conferma PIN" inputMode="numeric" maxLength="3" value={pin.pin_confirmation} onChange={(e) => setPin({ ...pin, pin_confirmation: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
          <button className="btn btn-primary btn-lg w-100">Aggiorna PIN</button>
        </form>
      </div>}
    </section>
  )
}
