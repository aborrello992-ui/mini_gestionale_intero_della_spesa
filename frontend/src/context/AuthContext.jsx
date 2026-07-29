import { useEffect, useMemo, useState } from 'react'
import api from '../api/client'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('auth_token')))

  useEffect(() => {
    if (!localStorage.getItem('auth_token')) return
    api.get('/me').then(({ data }) => setUser(data)).catch(() => localStorage.removeItem('auth_token')).finally(() => setLoading(false))
  }, [])

  const value = useMemo(() => ({
    user,
    loading,
    isAdmin: user?.role === 'admin',
    async login(credentials) {
      const { data } = await api.post('/login', credentials)
      localStorage.setItem('auth_token', data.token)
      setUser(data.user)
    },
    async logout() {
      try {
        await api.post('/logout')
      } finally {
        localStorage.removeItem('auth_token')
        setUser(null)
      }
    },
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
