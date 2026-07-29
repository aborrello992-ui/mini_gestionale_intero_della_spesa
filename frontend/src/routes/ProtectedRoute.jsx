import { Navigate, Outlet } from 'react-router-dom'
import Loading from '../components/Loading'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  return user ? <Outlet /> : <Navigate to="/login" replace />
}

export function AdminRoute() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />
}
