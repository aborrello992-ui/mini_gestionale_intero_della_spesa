import { useEffect, useState } from 'react'
import { KeyRound, UserPlus } from 'lucide-react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { errorMessage } from '../utils/format'
import PageHeader from '../components/layout/PageHeader'
import DataTable from '../components/tables/DataTable'
import FormField from '../components/forms/FormField'
import AppModal from '../components/ui/AppModal'
import UserAvatar from '../components/ui/UserAvatar'
import StatusBadge from '../components/ui/StatusBadge'

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [message, setMessage] = useState('')
  const [pinEdit, setPinEdit] = useState(null)
  const [pin, setPin] = useState({ pin: '', pin_confirmation: '' })
  const [form, setForm] = useState({ name: '', last_name: '', aliases: '', role: 'member', pin: '', pin_confirmation: '', is_active: true })

  async function load() { setUsers((await api.get('/users')).data) }
  useEffect(() => { load() }, [])

  async function submit(event) {
    event.preventDefault()
    try {
      await api.post('/users', { ...form, aliases: form.aliases ? form.aliases.split(',').map((value) => value.trim()).filter(Boolean) : [] })
      setMessage('Utente creato.')
      setForm({ name: '', last_name: '', aliases: '', role: 'member', pin: '', pin_confirmation: '', is_active: true })
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

  const columns = [
    { key: 'user', header: 'Utente', render: (user) => <div className="cluster"><UserAvatar name={user.name} /><div><strong>{user.name}</strong><div className="small text-muted-app">{user.last_name || user.email}</div></div></div> },
    { key: 'aliases', header: 'Alias', render: (user) => (user.aliases || []).join(', ') || '-' },
    { key: 'role', header: 'Ruolo', render: (user) => <StatusBadge tone={user.role === 'admin' ? 'primary' : 'info'}>{user.role === 'admin' ? 'Admin' : 'Membro'}</StatusBadge> },
    { key: 'status', header: 'Stato', render: (user) => <StatusBadge status={user.is_active ? 'active' : 'inactive'} /> },
    { key: 'created', header: 'Creato', render: (user) => new Date(user.created_at).toLocaleDateString('it-IT') },
    { key: 'actions', header: 'Azioni', render: (user) => <button className="btn btn-sm btn-outline-primary" onClick={() => setPinEdit(user)}><KeyRound size={15} /> PIN</button> },
  ]

  return (
    <section>
      <PageHeader title="Utenti" subtitle="Gestisci membri, ruoli, alias e PIN personali." primaryAction={<a href="#new-user" className="btn btn-primary"><UserPlus size={17} /> Nuovo membro</a>} />
      <AlertMessage type={['Utente creato.', 'PIN aggiornato correttamente.'].includes(message) ? 'success' : 'danger'}>{message}</AlertMessage>
      <form className="app-card form-grid mb-3" id="new-user" onSubmit={submit}>
        <FormField label="Nome"><input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></FormField>
        <FormField label="Cognome facoltativo"><input className="form-control" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></FormField>
        <FormField label="Alias" help="Separali con una virgola."><input className="form-control" value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} /></FormField>
        <FormField label="PIN iniziale" help="Esattamente 3 cifre."><input className="form-control pin-input" inputMode="numeric" type="password" maxLength="3" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 3) })} /></FormField>
        <FormField label="Conferma PIN"><input className="form-control pin-input" inputMode="numeric" type="password" maxLength="3" value={form.pin_confirmation} onChange={(e) => setForm({ ...form, pin_confirmation: e.target.value.replace(/\D/g, '').slice(0, 3) })} /></FormField>
        <FormField label="Ruolo"><select className="form-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="member">Membro</option><option value="admin">Amministratore</option></select></FormField>
        <FormField label="Stato"><select className="form-select" value={form.is_active ? '1' : '0'} onChange={(e) => setForm({ ...form, is_active: e.target.value === '1' })}><option value="1">Attivo</option><option value="0">Disattivato</option></select></FormField>
        <button className="btn btn-primary">Crea membro</button>
      </form>
      <DataTable
        columns={columns}
        rows={users}
        getKey={(user) => user.id}
        emptyTitle="Nessun utente disponibile"
        renderMobile={(user) => (
          <>
            <div className="split">
              <div className="cluster"><UserAvatar name={user.name} /><div><strong>{user.name}</strong><div className="small text-muted-app">{user.last_name || user.email}</div></div></div>
              <StatusBadge status={user.is_active ? 'active' : 'inactive'} />
            </div>
            <div className="small text-muted-app">Alias: {(user.aliases || []).join(', ') || '-'}</div>
            <button className="btn btn-outline-primary w-100" onClick={() => setPinEdit(user)}><KeyRound size={16} /> Modifica PIN</button>
          </>
        )}
      />
      {pinEdit && (
        <AppModal title={`Modifica PIN`} subtitle={pinEdit.name} onClose={() => setPinEdit(null)}>
          <form className="stack-md" onSubmit={updatePin}>
            <div className="summary-box">Il PIN attuale non viene mostrato. Inserisci e conferma il nuovo PIN a 3 cifre.</div>
            <FormField label="Nuovo PIN">
              <input className="form-control form-control-lg pin-input" type="password" inputMode="numeric" maxLength="3" value={pin.pin} onChange={(e) => setPin({ ...pin, pin: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
            </FormField>
            <FormField label="Conferma PIN">
              <input className="form-control form-control-lg pin-input" type="password" inputMode="numeric" maxLength="3" value={pin.pin_confirmation} onChange={(e) => setPin({ ...pin, pin_confirmation: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
            </FormField>
            <button className="btn btn-primary btn-lg w-100">Aggiorna PIN</button>
          </form>
        </AppModal>
      )}
    </section>
  )
}
