import { Suspense, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Boxes, ClipboardList, History, KeyRound, LogOut, Package, ReceiptText, ShoppingCart, Users, WalletCards } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import UserAvatar from '../components/ui/UserAvatar'
import Loading from '../components/Loading'
import GuestPinReveal from '../components/GuestPinReveal'

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

const guestLinks = [
  ['/', 'Prodotti', Boxes],
  ['/shopping-list', 'Spesa', ShoppingCart],
]

function NavItems() {
  const { isAdmin, isGuest } = useAuth()
  return (isGuest ? guestLinks : isAdmin ? [...links, ...adminLinks] : links).map(([to, label, Icon]) => (
    <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
      <Icon size={18} aria-hidden="true" /> <span>{label}</span>
    </NavLink>
  ))
}

export default function AppLayout() {
  const { user, isAdmin, isGuest, logout } = useAuth()
  const navigate = useNavigate()
  const guestPin = isGuest ? sessionStorage.getItem('guest_pin') : null
  const [showPin, setShowPin] = useState(() => Boolean(guestPin) && sessionStorage.getItem('guest_pin_reveal') === '1')
  const roleLabel = isAdmin ? 'Amministratore' : isGuest ? 'Ospite' : user?.role === 'member' ? 'Socio' : 'Dispositivo'

  function closePin() {
    sessionStorage.removeItem('guest_pin_reveal')
    setShowPin(false)
  }

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
          <div className="player-card" role="group" aria-label={`Accesso come ${user?.name || 'ospite'}, ${roleLabel.toLowerCase()}`}>
            <span className="player-tag" aria-hidden="true">{isGuest ? 'GST' : user?.role === 'device' ? 'CPU' : '1P'}</span>
            <UserAvatar name={user?.name} size="sm" />
            <div className="player-info min-0">
              <strong className="player-name">{user?.name}</strong>
              <span className="player-role">{roleLabel}</span>
            </div>
            {guestPin && <button type="button" className="player-exit" onClick={() => setShowPin(true)} aria-label="Mostra il tuo PIN"><KeyRound size={17} aria-hidden="true" /> <span>PIN</span></button>}
            <button type="button" className="player-exit" onClick={exit} aria-label="Esci">
              <LogOut size={17} aria-hidden="true" /> <span>Esci</span>
            </button>
          </div>
        </header>
        <Suspense fallback={<Loading />}>
          <Outlet />
        </Suspense>
      </main>

      {showPin && guestPin && <GuestPinReveal pin={guestPin} expiresAt={user?.guest_expires_at} onClose={closePin} />}

      <nav className="mobile-nav" aria-label="Navigazione principale">
        <NavItems />
      </nav>
    </div>
  )
}
