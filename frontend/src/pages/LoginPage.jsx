import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck, Store, UserRound } from 'lucide-react'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { useAuth } from '../hooks/useAuth'
import { errorMessage } from '../utils/format'
import FormField from '../components/forms/FormField'
import BossBattle from '../components/BossBattle'
import { useKickEntrance } from '../hooks/useKickEntrance'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [showAdmin, setShowAdmin] = useState(false)
  // Ospite: prima scrive il nome, poi entra e riceve il suo PIN personale.
  const [showGuest, setShowGuest] = useState(searchParams.has('ospite'))
  const [guestName, setGuestName] = useState('')
  const [members, setMembers] = useState([])
  const [form, setForm] = useState({ member_id: '', pin: '' })
  const [error, setError] = useState('')
  const { overlay, play, playing } = useKickEntrance()
  const battleRef = useRef(null)
  const enterRef = useRef(null) // come entrare, quando il server ha già risposto
  const timerRef = useRef(0)
  const [holding, setHolding] = useState(false) // server pronto, ma stai ancora giocando
  const busy = playing || holding

  useEffect(() => () => clearTimeout(timerRef.current), [])

  function proceed() {
    clearTimeout(timerRef.current)
    const go = enterRef.current
    if (!go) return
    enterRef.current = null
    setHolding(false)
    go()
  }

  // Server pronto: se non stai giocando entri subito; se stai giocando la partita continua,
  // compare "Server pronto · Entra nel sito", oppure entri da solo poco dopo la fine della partita.
  function serverReady(go) {
    const engagement = battleRef.current?.getEngagement() || 'idle'
    if (engagement === 'idle') return go()
    enterRef.current = go
    setHolding(true)
    if (engagement === 'ended') timerRef.current = setTimeout(proceed, 1800)
  }

  function onBattleEnd() {
    if (enterRef.current) timerRef.current = setTimeout(proceed, 2200)
  }

  useEffect(() => {
    api.get('/members').then(({ data }) => {
      setMembers(data)
      if (data.length === 1) setForm((current) => ({ ...current, member_id: String(data[0].id) }))
    }).catch((err) => setError(errorMessage(err)))
  }, [])

  async function adminLogin(event) {
    event.preventDefault()
    setError('')
    try {
      await play(() => login(form))
      serverReady(() => navigate('/products'))
    } catch (err) {
      setError(errorMessage(err))
      setForm((current) => ({ ...current, pin: '' }))
    }
  }

  async function guestLogin(event) {
    event.preventDefault()
    setError('')
    try {
      await play(async () => {
        const { data } = await api.post('/guest', { name: guestName.trim() })
        localStorage.setItem('auth_token', data.token)
        // Il PIN generato viene mostrato con l'animazione appena si entra.
        sessionStorage.setItem('guest_pin', data.pin)
        sessionStorage.setItem('guest_pin_reveal', '1')
      })
      serverReady(() => { window.location.href = '/products' })
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

      <div className="arena-game">
        <BossBattle ref={battleRef} waiting={playing} caption="Attendo il server…" onEnd={onBattleEnd} onEnter={holding ? proceed : undefined} />
      </div>

      <div className="login-box">
        <div className="login-brand">
          <span className="brand-mark"><Store size={22} /></span>
          <h1>Gestionale Locale</h1>
          <p className="login-tagline mb-0" aria-hidden="true">Press start</p>
          <p className="text-muted-app mb-0">Sei di passaggio? Entra come ospite e ricevi il tuo PIN. Sei un socio? Entra con il tuo nome e il tuo PIN.</p>
        </div>
        <AlertMessage>{error}</AlertMessage>
        {!showAdmin && !showGuest && <>
          <button className="btn btn-primary btn-lg w-100" type="button" onClick={() => { setError(''); setShowGuest(true) }} disabled={busy}><UserRound size={19} /> Entra come ospite</button>
          <button className="btn btn-outline-secondary btn-lg w-100 mt-2" type="button" onClick={() => { setError(''); setShowAdmin(true) }} disabled={busy}><ShieldCheck size={19} /> Area socio / amministratore</button>
        </>}
        {showGuest && <form className="stack-md" onSubmit={guestLogin}>
          <FormField label="Come ti chiami?" htmlFor="guest-name" help="Il nome appare ai soci; riceverai un PIN solo per te.">
            <input id="guest-name" className="form-control form-control-lg" autoComplete="given-name" maxLength={40} placeholder="Es. Marco" value={guestName} onChange={(e) => setGuestName(e.target.value)} autoFocus />
          </FormField>
          <button className="btn btn-primary btn-lg w-100" disabled={busy || guestName.trim().length < 2}><UserRound size={19} /> Entra e ricevi il PIN</button>
          <button className="btn btn-link w-100" type="button" onClick={() => setShowGuest(false)} disabled={busy}>Torna indietro</button>
        </form>}
        {showAdmin && <form className="stack-md" onSubmit={adminLogin}>
          <FormField label="Chi sei?" htmlFor="login-admin">
            <select id="login-admin" className="form-select form-select-lg" value={form.member_id} onChange={(e) => setForm({ ...form, member_id: e.target.value })}>
              <option value="">Scegli il tuo nome</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}{member.role === 'admin' ? ' · amministratore' : ''}</option>)}
            </select>
          </FormField>
          <FormField label="PIN personale" help="3 cifre. Il PIN non viene salvato nel browser." htmlFor="login-pin">
            <input id="login-pin" className="form-control form-control-lg pin-input" type="password" inputMode="numeric" maxLength="3" autoComplete="one-time-code" value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
          </FormField>
          <button className="btn btn-primary btn-lg w-100" disabled={busy || !form.member_id || form.pin.length !== 3}><ShieldCheck size={19} /> Entra</button>
          <button className="btn btn-link w-100 mt-2" type="button" onClick={() => setShowAdmin(false)} disabled={busy}>Torna indietro</button>
        </form>}
      </div>
      {overlay}
    </main>
  )
}
