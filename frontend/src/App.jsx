import { useEffect, useState, useCallback } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { api } from './api.js'
import Login from './pages/Login.jsx'
import Notes from './pages/Notes.jsx'
import Links from './pages/Links.jsx'
import Layout from './pages/Layout.jsx'
import IdentityGate from './pages/IdentityGate.jsx'

const IDENTITY_KEY = 'salma-notes:identity'

export default function App() {
  const [authStatus, setAuthStatus] = useState('checking') // checking | out | in
  const [identity, setIdentity] = useState(() => localStorage.getItem(IDENTITY_KEY) || '')
  const [names, setNames] = useState([])

  useEffect(() => {
    api.getConfig().then((cfg) => setNames(cfg.names || [])).catch(() => {})
  }, [])

  const checkAuth = useCallback(() => {
    api.me()
      .then(() => setAuthStatus('in'))
      .catch(() => setAuthStatus('out'))
  }, [])

  useEffect(() => { checkAuth() }, [checkAuth])

  const chooseIdentity = (name) => {
    localStorage.setItem(IDENTITY_KEY, name)
    setIdentity(name)
  }

  const handleLogout = () => {
    api.logout().finally(() => setAuthStatus('out'))
  }

  if (authStatus === 'checking') {
    return <div className="screen-center"><div className="loader" aria-label="Loading" /></div>
  }

  if (authStatus === 'out') {
    return <Login onSuccess={() => setAuthStatus('in')} />
  }

  if (!identity) {
    return <IdentityGate names={names} onChoose={chooseIdentity} />
  }

  return (
    <Routes>
      <Route
        element={<Layout identity={identity} onSwitchIdentity={() => setIdentity('')} onLogout={handleLogout} />}
      >
        <Route path="/" element={<Notes identity={identity} names={names} />} />
        <Route path="/links" element={<Links />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
