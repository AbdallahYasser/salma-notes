import { useState } from 'react'
import { api } from '../api.js'
import PasswordField from '../PasswordField.jsx'

const FALLBACK_NAMES = ['Me', 'Friend']

export default function Login({ names, currentIdentity, onSuccess }) {
  const options = names && names.length ? names : FALLBACK_NAMES
  const [identity, setIdentity] = useState(currentIdentity || '')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!identity || !password.trim()) return
    setBusy(true)
    setError('')
    try {
      await api.login(password)
      onSuccess(identity)
    } catch (err) {
      setError(err.status === 403 ? 'Wrong password.' : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="screen-center">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-mark">✎</div>
        <h1 className="auth-title">Salma Notes</h1>
        <p className="auth-sub">A little place to leave things for each other.</p>

        <div className="identity-options">
          {options.map((name) => (
            <button
              key={name}
              type="button"
              className={identity === name ? 'identity-chip identity-chip-active' : 'identity-chip'}
              onClick={() => setIdentity(name)}
            >
              <span className="avatar" data-name={name}>{name.charAt(0).toUpperCase()}</span>
              {name}
            </button>
          ))}
        </div>

        <PasswordField
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="auth-error">{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={busy || !identity || !password.trim()}>
          {busy ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </div>
  )
}
