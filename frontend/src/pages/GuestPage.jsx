import { useEffect } from 'react'
import api from '../api/client'

export default function GuestPage() {
  useEffect(() => {
    api.post('/guest').then(({ data }) => {
      localStorage.setItem('auth_token', data.token)
      window.location.href = '/products'
    })
  }, [])

  return <main className="login-page"><div className="login-box">Accesso ospite in corso...</div></main>
}
