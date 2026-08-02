import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Store, UserRound } from 'lucide-react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { useAuth } from '../hooks/useAuth'
import { errorMessage } from '../utils/format'
import FormField from '../components/forms/FormField'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [showAdmin, setShowAdmin] = useState(false)
  const [members, setMembers] = useState([])
  const [form, setForm] = useState({ member_id: '', pin: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/members').then(({ data }) => {
      setMembers(data)
      const admin = data.find((member) => member.role === 'admin')
      if (admin) setForm((current) => ({ ...current, member_id: String(admin.id) }))
    }).catch((err) => setError(errorMessage(err)))
  }, [])

  async function adminLogin(event) {
    event.preventDefault()
    setError('')
    try {
      await login(form)
      navigate('/products')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function guestLogin() {
    setError('')
    try {
      const { data } = await api.post('/guest')
      localStorage.setItem('auth_token', data.token)
      window.location.href = '/products'
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <main className="login-page">
      <div className="login-box">
        <div className="login-brand">
          <span className="brand-mark"><Store size={22} /></span>
          <h1>Gestionale Locale</h1>
          <p className="text-muted-app mb-0">Usa l’accesso ospite sul dispositivo condiviso oppure entra in area amministratore con il PIN personale.</p>
        </div>
        <AlertMessage>{error}</AlertMessage>
        {!showAdmin && <>
          <button className="btn btn-primary btn-lg w-100" type="button" onClick={guestLogin}><UserRound size={19} /> Entra come ospite</button>
          <button className="btn btn-outline-secondary btn-lg w-100 mt-2" type="button" onClick={() => setShowAdmin(true)}><ShieldCheck size={19} /> Area amministratore</button>
        </>}
        {showAdmin && <form className="stack-md" onSubmit={adminLogin}>
          <FormField label="Amministratore">
            <select className="form-select form-select-lg" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}>
              <option value="">Scegli amministratore</option>
              {members.filter((member) => member.role === 'admin').map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </FormField>
          <FormField label="PIN personale" help="3 cifre. Il PIN non viene salvato nel browser.">
            <input className="form-control form-control-lg pin-input" type="password" inputMode="numeric" maxLength="3" autoComplete="one-time-code" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
          </FormField>
          <button className="btn btn-primary btn-lg w-100" disabled={!form.member_id || form.pin.length !== 3}><ShieldCheck size={19} /> Entra in area amministratore</button>
          <button className="btn btn-link w-100 mt-2" type="button" onClick={() => setShowAdmin(false)}>Torna all’accesso ospite</button>
        </form>}
      </div>
    </main>
  )
}
