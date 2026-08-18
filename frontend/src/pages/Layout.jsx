import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { colorFor } from '../colorFor.js'
import PasswordModal from './PasswordModal.jsx'

const navClass = ({ isActive }) => (isActive ? 'page-nav-link page-nav-link-active' : 'page-nav-link')

export default function Layout({ identity, onSwitchIdentity, onLogout }) {
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✎</span>
          <span className="brand-name">Salma Notes</span>
        </div>
        <nav className="page-nav">
          <NavLink to="/" className={navClass} end>Notes</NavLink>
          <NavLink to="/links" className={navClass}>Links</NavLink>
        </nav>
        <div className="topbar-actions">
          <button className="identity-pill" onClick={onSwitchIdentity} title="Switch who you are">
            <span className="avatar" style={{ background: colorFor(identity) }}>{identity.charAt(0).toUpperCase()}</span>
            {identity}
          </button>
          <button className="icon-btn" onClick={() => setShowPasswordModal(true)} title="Change password">⚙</button>
          <button className="icon-btn" onClick={onLogout} title="Log out">⏻</button>
        </div>
      </header>

      {showPasswordModal && <PasswordModal onClose={() => setShowPasswordModal(false)} />}

      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
