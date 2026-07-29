import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AlertMessage from '../components/AlertMessage'
import { useAuth } from '../hooks/useAuth'
import { errorMessage } from '../utils/format'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: 'admin@locale.test', password: 'password' })
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    try {
      await login(form)
      navigate('/')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function loginDevice() {
    setError('')
    try {
      await login({ email: 'device@locale.test', password: 'password' })
      navigate('/')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <main className="login-page">
      <form className="login-box" onSubmit={submit}>
        <h1>Gestionale Locale</h1>
        <p className="text-secondary">Accedi per gestire prodotti, prelievi e cassa comune.</p>
        <AlertMessage>{error}</AlertMessage>
        <label className="form-label">Email</label>
        <input className="form-control form-control-lg mb-3" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <label className="form-label">Password</label>
        <input className="form-control form-control-lg mb-4" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <button className="btn btn-primary btn-lg w-100">Entra</button>
        <button className="btn btn-outline-secondary btn-lg w-100 mt-2" type="button" onClick={loginDevice}>Dispositivo locale</button>
      </form>
    </main>
  )
}
