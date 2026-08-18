import { useState } from 'react'

export default function PasswordField({ value, onChange, placeholder, autoFocus }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-field">
      <input
        className="input"
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
