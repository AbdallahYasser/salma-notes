const FALLBACK_NAMES = ['Me', 'Friend']

export default function IdentityGate({ names, onChoose }) {
  const options = names && names.length ? names : FALLBACK_NAMES
  return (
    <div className="screen-center">
      <div className="auth-card">
        <div className="auth-mark">👋</div>
        <h1 className="auth-title">Who's this?</h1>
        <p className="auth-sub">So notes know who left them. This is remembered on this device only.</p>
        <div className="identity-options">
          {options.map((name) => (
            <button key={name} className="identity-chip" onClick={() => onChoose(name)}>
              <span className="avatar" data-name={name}>{name.charAt(0).toUpperCase()}</span>
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
