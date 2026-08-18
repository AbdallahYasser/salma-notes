import { useState } from 'react'
import { api } from '../api.js'

export default function PasswordModal({ onClose }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 4) {
      setError('New password must be at least 4 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.")
      return
    }
    setBusy(true)
    try {
      await api.changePassword(currentPassword, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err.status === 403 ? 'Current password is wrong.' : 'Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {success ? (
          <>
            <h2 className="modal-title">Password changed</h2>
            <p className="auth-sub">
              Remember to tell your friend the new password — this login is shared, so their old one
              stops working now too.
            </p>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 className="modal-title">Change password</h2>
            <p className="auth-sub">
              This changes the one shared login for the whole site — you'll need to tell your friend
              the new one.
            </p>
            <div className="modal-fields">
              <input
                className="input"
                type="password"
                placeholder="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoFocus
              />
              <input
                className="input"
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <input
                className="input"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {error && <p className="auth-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="text-btn" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Save password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
