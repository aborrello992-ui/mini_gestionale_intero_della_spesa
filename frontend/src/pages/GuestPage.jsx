import { Navigate } from 'react-router-dom'

/** Link diretto /guest: apre l'accesso ospite, dove si scrive il nome prima di entrare. */
export default function GuestPage() {
  return <Navigate to="/login?ospite=1" replace />
}
