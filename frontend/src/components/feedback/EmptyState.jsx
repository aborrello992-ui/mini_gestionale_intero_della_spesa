import { Inbox } from 'lucide-react'

export default function EmptyState({ title, message, action, icon: Icon = Inbox }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon"><Icon size={22} aria-hidden="true" /></div>
      <h2>{title}</h2>
      {message && <p className="mb-0">{message}</p>}
      {action}
    </div>
  )
}
