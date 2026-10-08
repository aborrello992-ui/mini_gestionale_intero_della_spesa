import { useEffect } from 'react'
import api from '../api/client'

/** Link diretto /guest: entra come ospite e mostra subito il PIN generato. */
export default function GuestPage() {
  useEffect(() => {
    api.post('/guest').then(({ data }) => {
      localStorage.setItem('auth_token', data.token)
      sessionStorage.setItem('guest_pin', data.pin)
      sessionStorage.setItem('guest_pin_reveal', '1')
      window.location.href = '/products'
    })
  }, [])

  return <main className="login-page"><div className="login-box">Accesso ospite in corso...</div></main>
}
