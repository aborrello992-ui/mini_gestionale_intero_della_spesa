import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Boxes, ClipboardList, History, LogOut, Package, ReceiptText, ShoppingCart, Users, WalletCards } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import UserAvatar from '../components/ui/UserAvatar'

const links = [
  ['/', 'Prodotti', Boxes],
  ['/debts', 'Debiti', ReceiptText],
  ['/cash', 'Cassa', WalletCards],
  ['/movements', 'Storico', History],
  ['/shopping-list', 'Spesa', ShoppingCart],
]
const adminLinks = [
  ['/admin/management', 'Gestione', ClipboardList],
  ['/admin/products', 'Magazzino', Package],
  ['/admin/users', 'Utenti', Users],
]

function NavItems() {
  const { isAdmin } = useAuth()
  return (isAdmin ? [...links, ...adminLinks] : links).map(([to, label, Icon]) => (
    <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <Icon size={18} aria-hidden="true" /> <span>{label}</span>
    </NavLink>
  ))
}

export default function AppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  async function exit() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenuto">Vai al contenuto</a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">店</span>
          <span className="brand-text">Gestionale<small>Locale</small></span>
        </div>
        <nav className="nav-list" aria-label="Sezioni">
          <NavItems />
        </nav>
        <div className="sidebar-kanji" aria-hidden="true">闘</div>
      </aside>

      <main className="content" id="contenuto">
        <header className="topbar">
          <div className="player-card" role="group" aria-label={`Accesso come ${user?.name || 'ospite'}, ${isAdmin ? 'amministratore' : 'ospite'}`}>
            <span className="player-tag" aria-hidden="true">{isAdmin ? '1P' : 'CPU'}</span>
            <UserAvatar name={user?.name} size="sm" />
            <div className="player-info min-0">
              <strong className="player-name">{user?.name}</strong>
              <span className="player-role">{isAdmin ? 'Amministratore' : 'Ospite'}</span>
            </div>
            <button type="button" className="player-exit" onClick={exit} aria-label="Esci">
              <LogOut size={17} aria-hidden="true" /> <span>Esci</span>
            </button>
          </div>
        </header>
        <Outlet />
      </main>

      <nav className="mobile-nav" aria-label="Navigazione principale">
        <NavItems />
      </nav>
    </div>
  )
}
