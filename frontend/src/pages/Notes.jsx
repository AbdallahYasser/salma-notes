import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'all', label: 'All' },
  { key: 'done', label: 'Done' },
]

const AVATAR_COLORS = ['#c9704f', '#5b7f6b', '#6d6ab8', '#b8894f', '#4f8fa8', '#a8567e']

function colorFor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function formatWhen(iso) {
  const then = new Date(iso.replace(' ', 'T') + 'Z')
  const diffMs = Date.now() - then.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function reminderStatus(remindAt) {
  if (!remindAt) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(remindAt + 'T00:00:00')
  const diffDays = Math.round((due - today) / 86400000)
  if (diffDays < 0) return { label: 'Overdue', tone: 'overdue' }
  if (diffDays === 0) return { label: 'Today', tone: 'today' }
  if (diffDays === 1) return { label: 'Tomorrow', tone: 'upcoming' }
  return { label: due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), tone: 'upcoming' }
}

export default function Notes({ identity, names, onSwitchIdentity, onLogout }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const [content, setContent] = useState('')
  const [kind, setKind] = useState('note')
  const [remindAt, setRemindAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmingId, setConfirmingId] = useState(null)

  const load = () => {
    api.listNotes().then((data) => setNotes(data.rows)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const counts = useMemo(() => ({
    open: notes.filter((n) => !n.done).length,
    reminders: notes.filter((n) => n.kind === 'reminder' && !n.done).length,
    all: notes.length,
    done: notes.filter((n) => n.done).length,
  }), [notes])

  const visible = useMemo(() => {
    let rows = notes
    if (filter === 'open') rows = notes.filter((n) => !n.done)
    else if (filter === 'reminders') rows = notes.filter((n) => n.kind === 'reminder' && !n.done)
    else if (filter === 'done') rows = notes.filter((n) => n.done)
    return rows
  }, [notes, filter])

  const submit = async (e) => {
    e.preventDefault()
    const text = content.trim()
    if (!text) return
    setSubmitting(true)
    try {
      const note = await api.createNote({
        author: identity,
        content: text,
        kind,
        remind_at: kind === 'reminder' && remindAt ? remindAt : null,
      })
      setNotes((prev) => [note, ...prev])
      setContent('')
      setKind('note')
      setRemindAt('')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleDone = async (note) => {
    const updated = await api.updateNote(note.id, { done: note.done ? 0 : 1 })
    setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)))
  }

  const removeNote = async (id) => {
    await api.deleteNote(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
    setConfirmingId(null)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">✎</span>
          <span className="brand-name">Salma Notes</span>
        </div>
        <div className="topbar-actions">
          <button className="identity-pill" onClick={onSwitchIdentity} title="Switch who you are">
            <span className="avatar" style={{ background: colorFor(identity) }}>{identity.charAt(0).toUpperCase()}</span>
            {identity}
          </button>
          <button className="icon-btn" onClick={onLogout} title="Log out">⏻</button>
        </div>
      </header>

      <main className="content">
        <form className="composer" onSubmit={submit}>
          <textarea
            className="composer-input"
            placeholder={`Leave something for ${names.find((n) => n !== identity) || 'them'}…`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
          />
          <div className="composer-row">
            <div className="kind-toggle">
              <button type="button" className={kind === 'note' ? 'chip chip-active' : 'chip'} onClick={() => setKind('note')}>Note</button>
              <button type="button" className={kind === 'reminder' ? 'chip chip-active' : 'chip'} onClick={() => setKind('reminder')}>Reminder</button>
            </div>
            {kind === 'reminder' && (
              <input
                type="date"
                className="input input-date"
                value={remindAt}
                onChange={(e) => setRemindAt(e.target.value)}
              />
            )}
            <button className="btn btn-primary composer-submit" type="submit" disabled={submitting || !content.trim()}>
              Add
            </button>
          </div>
        </form>

        <nav className="filters">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={filter === f.key ? 'filter-tab filter-tab-active' : 'filter-tab'}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="filter-count">{counts[f.key]}</span>
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <p>Nothing here yet.</p>
            <p className="empty-sub">Write the first one above.</p>
          </div>
        ) : (
          <ul className="note-list">
            {visible.map((note) => {
              const status = note.kind === 'reminder' && !note.done ? reminderStatus(note.remind_at) : null
              return (
                <li key={note.id} className={note.done ? 'note-card note-card-done' : 'note-card'}>
                  <span className="avatar avatar-sm" style={{ background: colorFor(note.author) }}>
                    {note.author.charAt(0).toUpperCase()}
                  </span>
                  <div className="note-body">
                    <div className="note-meta">
                      <span className="note-author">{note.author}</span>
                      <span className="note-dot">·</span>
                      <span className="note-time">{formatWhen(note.created_at)}</span>
                      {status && <span className={`badge badge-${status.tone}`}>{status.label}</span>}
                    </div>
                    <p className="note-content">{note.content}</p>
                  </div>
                  <div className="note-actions">
                    <button
                      className={note.done ? 'check-btn check-btn-done' : 'check-btn'}
                      onClick={() => toggleDone(note)}
                      title={note.done ? 'Mark as open' : 'Mark as done'}
                    >
                      {note.done ? '✓' : ''}
                    </button>
                    {confirmingId === note.id ? (
                      <span className="confirm-row">
                        <button className="text-btn text-btn-danger" onClick={() => removeNote(note.id)}>Delete</button>
                        <button className="text-btn" onClick={() => setConfirmingId(null)}>Cancel</button>
                      </span>
                    ) : (
                      <button className="icon-btn icon-btn-ghost" onClick={() => setConfirmingId(note.id)} title="Delete">✕</button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
