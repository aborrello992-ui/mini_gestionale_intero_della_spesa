import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Store, UserRound } from 'lucide-react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { useAuth } from '../hooks/useAuth'
import { errorMessage } from '../utils/format'
import FormField from '../components/forms/FormField'
import { IdleFighter } from '../components/KickEntrance'
import { useKickEntrance } from '../hooks/useKickEntrance'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [showAdmin, setShowAdmin] = useState(false)
  const [members, setMembers] = useState([])
  const [form, setForm] = useState({ member_id: '', pin: '' })
  const [error, setError] = useState('')
  const { overlay, play, playing } = useKickEntrance()

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
      await play(() => login(form), () => navigate('/products'))
    } catch (err) {
      setError(errorMessage(err))
      setForm((current) => ({ ...current, pin: '' }))
    }
  }

  async function guestLogin() {
    setError('')
    try {
      await play(async () => {
        const { data } = await api.post('/guest')
        localStorage.setItem('auth_token', data.token)
      }, () => { window.location.href = '/products' })
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <main className="login-page login-arena">
      <div className="arena-backdrop" aria-hidden="true">
        <div className="arena-hud">
          <div className="arena-score"><span>1P</span> 000000 <span>HI</span> 945520</div>
          <div className="arena-bars">
            <div className="arena-bar"><i /></div>
            <strong className="arena-ko">KO</strong>
            <div className="arena-bar is-right"><i /></div>
          </div>
          <div className="arena-names"><span>Soci</span><span>Locale</span></div>
        </div>
        <div className="arena-stage" />
      </div>

      <div className="arena-fighter">
        <IdleFighter hidden={playing} />
      </div>

      <div className="login-box">
        <div className="login-brand">
          <span className="brand-mark"><Store size={22} /></span>
          <h1>Gestionale Locale</h1>
          <p className="login-tagline mb-0" aria-hidden="true">Press start</p>
          <p className="text-muted-app mb-0">Usa l’accesso ospite sul dispositivo condiviso oppure entra in area amministratore con il PIN personale.</p>
        </div>
        <AlertMessage>{error}</AlertMessage>
        {!showAdmin && <>
          <button className="btn btn-primary btn-lg w-100" type="button" onClick={guestLogin} disabled={playing}><UserRound size={19} /> Entra come ospite</button>
          <button className="btn btn-outline-secondary btn-lg w-100 mt-2" type="button" onClick={() => setShowAdmin(true)} disabled={playing}><ShieldCheck size={19} /> Area amministratore</button>
        </>}
        {showAdmin && <form className="stack-md" onSubmit={adminLogin}>
          <FormField label="Amministratore" htmlFor="login-admin">
            <select id="login-admin" className="form-select form-select-lg" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}>
              <option value="">Scegli amministratore</option>
              {members.filter((member) => member.role === 'admin').map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </FormField>
          <FormField label="PIN personale" help="3 cifre. Il PIN non viene salvato nel browser." htmlFor="login-pin">
            <input id="login-pin" className="form-control form-control-lg pin-input" type="password" inputMode="numeric" maxLength="3" autoComplete="one-time-code" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
          </FormField>
          <button className="btn btn-primary btn-lg w-100" disabled={playing || !form.member_id || form.pin.length !== 3}><ShieldCheck size={19} /> Entra in area amministratore</button>
          <button className="btn btn-link w-100 mt-2" type="button" onClick={() => setShowAdmin(false)} disabled={playing}>Torna all’accesso ospite</button>
        </form>}
      </div>
      {overlay}
    </main>
  )
}
