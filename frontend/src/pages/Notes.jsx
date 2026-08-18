import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import NoteThread from './NoteThread.jsx'

const FILTERS = [
  { key: 'open', label: 'Open' },
  { key: 'reminders', label: 'Reminders' },
  { key: 'all', label: 'All' },
  { key: 'done', label: 'Done' },
]

export default function Notes({ identity, names }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('open')
  const [content, setContent] = useState('')
  const [kind, setKind] = useState('note')
  const [remindAt, setRemindAt] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    api.listNotes().then((data) => setNotes(data.rows)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const topLevelNotes = useMemo(() => notes.filter((n) => !n.parent_id), [notes])

  const repliesByParent = useMemo(() => {
    const map = {}
    for (const n of notes) {
      if (n.parent_id) (map[n.parent_id] ||= []).push(n)
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at))
    }
    return map
  }, [notes])

  const counts = useMemo(() => ({
    open: topLevelNotes.filter((n) => !n.done).length,
    reminders: topLevelNotes.filter((n) => n.kind === 'reminder' && !n.done).length,
    all: topLevelNotes.length,
    done: topLevelNotes.filter((n) => n.done).length,
  }), [topLevelNotes])

  const visible = useMemo(() => {
    let rows = topLevelNotes
    if (filter === 'open') rows = topLevelNotes.filter((n) => !n.done)
    else if (filter === 'reminders') rows = topLevelNotes.filter((n) => n.kind === 'reminder' && !n.done)
    else if (filter === 'done') rows = topLevelNotes.filter((n) => n.done)
    return rows
  }, [topLevelNotes, filter])

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
  }

  const addReply = (reply) => {
    setNotes((prev) => [...prev, reply])
  }

  return (
    <>
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
            {visible.map((note) => (
              <NoteThread
                key={note.id}
                note={note}
                replies={repliesByParent[note.id] || []}
                identity={identity}
                onToggleDone={toggleDone}
                onDelete={removeNote}
                onReplyAdded={addReply}
              />
            ))}
          </ul>
        )}
    </>
  )
}
