import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Boxes, ClipboardList, History, LogOut, ReceiptText, ShoppingCart, Users, WalletCards } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const links = [
  ['/', 'Prodotti', Boxes],
  ['/debts', 'Debiti', ReceiptText],
  ['/cash', 'Cassa', WalletCards],
  ['/movements', 'Movimenti', History],
  ['/shopping-list', 'Lista spesa', ShoppingCart],
]

export default function AppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const visibleLinks = isAdmin ? [...links, ['/admin/management', 'Gestione', ClipboardList], ['/admin/users', 'Utenti', Users]] : links

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">Gestionale Locale</div>
        <nav className="nav-list">
          {visibleLinks.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={18} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="btn btn-outline-light w-100 mt-auto" onClick={async () => { await logout(); navigate('/login') }}>
          <LogOut size={17} /> Logout
        </button>
      </aside>
      <main className="content">
        <header className="topbar">
          <div>
            <div className="small text-secondary">Accesso</div>
            <strong>{user?.name}</strong>
          </div>
          <span className="badge text-bg-dark">{isAdmin ? 'admin' : 'membro'}</span>
        </header>
        <Outlet />
      </main>
    </div>
  )
}
