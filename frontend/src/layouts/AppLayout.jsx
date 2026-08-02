import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Boxes, ClipboardList, History, LogOut, Package, ReceiptText, ShoppingCart, Store, Users, WalletCards } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import StatusBadge from '../components/ui/StatusBadge'
import UserAvatar from '../components/ui/UserAvatar'

const links = [
  ['/', 'Prodotti', Boxes],
  ['/debts', 'Debiti', ReceiptText],
  ['/cash', 'Cassa', WalletCards],
  ['/movements', 'Storico', History],
  ['/shopping-list', 'Lista spesa', ShoppingCart],
]

export default function AppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const visibleLinks = isAdmin ? [...links, ['/admin/management', 'Gestione', ClipboardList], ['/admin/products', 'Prodotti admin', Package], ['/admin/users', 'Utenti', Users]] : links

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Store size={20} /></span><span>Gestionale Locale</span></div>
        <nav className="nav-list">
          {visibleLinks.map(([to, label, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={18} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-pill">
            <UserAvatar name={user?.name} size="sm" />
            <div className="min-0">
              <div className="small text-white-50">Accesso</div>
              <strong className="d-block text-truncate">{user?.name}</strong>
            </div>
          </div>
          <button className="btn btn-outline-light w-100" onClick={async () => { await logout(); navigate('/login') }}>
            <LogOut size={17} /> Esci
          </button>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <div className="user-pill">
            <UserAvatar name={user?.name} size="sm" />
            <div className="min-0">
              <div className="small text-muted-app">Modalità</div>
              <strong className="d-block text-truncate">{user?.name}</strong>
            </div>
          </div>
          <StatusBadge tone={isAdmin ? 'primary' : 'info'}>{isAdmin ? 'Amministratore' : 'Ospite'}</StatusBadge>
        </header>
        <Outlet />
      </main>
      <nav className="mobile-nav" aria-label="Navigazione principale">
        {visibleLinks.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={18} /> <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
