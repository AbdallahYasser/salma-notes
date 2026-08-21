import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatWhen } from '../formatWhen.js'

export default function Trash() {
  const [notes, setNotes] = useState([])
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getTrash()
      .then((data) => {
        setNotes(data.notes)
        setLinks(data.links)
      })
      .finally(() => setLoading(false))
  }, [])

  const restoreNote = async (id) => {
    await api.restoreNote(id)
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  const restoreLink = async (id) => {
    await api.restoreLink(id)
    setLinks((prev) => prev.filter((l) => l.id !== id))
  }

  const isEmpty = notes.length === 0 && links.length === 0

  return (
    <>
      <p className="trash-hint">Deleted items stay here for 30 days, then are gone for good.</p>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : isEmpty ? (
        <div className="empty-state">
          <p>Trash is empty.</p>
        </div>
      ) : (
        <>
          {notes.length > 0 && (
            <section className="trash-section">
              <h3 className="trash-section-title">Notes &amp; reminders</h3>
              <ul className="trash-list">
                {notes.map((note) => (
                  <li key={note.id} className="trash-item">
                    <div className="trash-item-body">
                      <div className="trash-item-meta">
                        <span className="trash-kind">{note.kind === 'reminder' ? 'Reminder' : 'Note'}</span>
                        {note.parent_id != null && <span className="trash-kind trash-kind-muted">Reply</span>}
                        <span className="note-dot">·</span>
                        <span className="note-time">deleted {formatWhen(note.deleted_at)}</span>
                      </div>
                      <p className="note-content">{note.content}</p>
                    </div>
                    <button className="text-btn" onClick={() => restoreNote(note.id)}>Restore</button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {links.length > 0 && (
            <section className="trash-section">
              <h3 className="trash-section-title">Links</h3>
              <ul className="trash-list">
                {links.map((link) => (
                  <li key={link.id} className="trash-item">
                    <div className="trash-item-body">
                      <div className="trash-item-meta">
                        <span className="trash-kind">{link.topic_title}</span>
                        {link.category_title && <span className="trash-kind trash-kind-muted">{link.category_title}</span>}
                        <span className="note-dot">·</span>
                        <span className="note-time">deleted {formatWhen(link.deleted_at)}</span>
                      </div>
                      <p className="note-content">{link.title}</p>
                      <p className="trash-item-url">{link.url}</p>
                    </div>
                    <button className="text-btn" onClick={() => restoreLink(link.id)}>Restore</button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  )
}
