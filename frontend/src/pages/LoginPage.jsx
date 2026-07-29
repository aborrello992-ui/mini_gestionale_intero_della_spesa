import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import AlertMessage from '../components/AlertMessage'
import { useAuth } from '../hooks/useAuth'
import { errorMessage } from '../utils/format'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [showAdmin, setShowAdmin] = useState(false)
  const [form, setForm] = useState({ email: 'admin@locale.test', password: 'password' })
  const [error, setError] = useState('')

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
        <h1>Gestionale Locale</h1>
        <p className="text-secondary">Usa l’accesso ospite sul dispositivo condiviso oppure accedi come amministratore.</p>
        <AlertMessage>{error}</AlertMessage>
        {!showAdmin && <>
          <button className="btn btn-primary btn-lg w-100" type="button" onClick={guestLogin}>Entra come ospite</button>
          <button className="btn btn-outline-secondary btn-lg w-100 mt-2" type="button" onClick={() => setShowAdmin(true)}>Accesso amministratore</button>
        </>}
        {showAdmin && <form onSubmit={adminLogin}>
          <label className="form-label">Email</label>
          <input className="form-control form-control-lg mb-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <label className="form-label">Password</label>
          <input className="form-control form-control-lg mb-4" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <button className="btn btn-primary btn-lg w-100">Entra</button>
          <button className="btn btn-link w-100 mt-2" type="button" onClick={() => setShowAdmin(false)}>Torna all’accesso ospite</button>
        </form>}
      </div>
    </main>
  )
}
