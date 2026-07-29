import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Boxes, ClipboardList, Gauge, History, LogOut, ShoppingCart, Users, WalletCards, Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

const links = [
  ['/', 'Dashboard', Gauge],
  ['/products', 'Prodotti', Boxes],
  ['/withdraw', 'Prelievo', Zap],
  ['/shopping-list', 'Spesa', ShoppingCart],
  ['/cash', 'Cassa', WalletCards],
  ['/history', 'Storico', History],
]

export default function AppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const visibleLinks = isAdmin ? [...links, ['/users', 'Utenti', Users], ['/purchases', 'Acquisti', ClipboardList]] : links

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
