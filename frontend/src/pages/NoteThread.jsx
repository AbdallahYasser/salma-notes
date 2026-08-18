import { useState } from 'react'
import { api } from '../api.js'
import { colorFor } from '../colorFor.js'

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

export default function NoteThread({ note, replies, identity, onToggleDone, onDelete, onReplyAdded }) {
  const [confirming, setConfirming] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyConfirmId, setReplyConfirmId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const status = note.kind === 'reminder' && !note.done ? reminderStatus(note.remind_at) : null

  const submitReply = async (e) => {
    e.preventDefault()
    const text = replyText.trim()
    if (!text) return
    setSubmitting(true)
    try {
      const reply = await api.createNote({ author: identity, content: text, parent_id: note.id })
      onReplyAdded(reply)
      setReplyText('')
      setReplyOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <li className={note.done ? 'note-card note-card-done' : 'note-card'}>
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

        {replies.length > 0 && (
          <ul className="thread-list">
            {replies.map((reply) => (
              <li key={reply.id} className="thread-item">
                <span className="avatar avatar-xs" style={{ background: colorFor(reply.author) }}>
                  {reply.author.charAt(0).toUpperCase()}
                </span>
                <div className="thread-body">
                  <div className="note-meta">
                    <span className="note-author">{reply.author}</span>
                    <span className="note-dot">·</span>
                    <span className="note-time">{formatWhen(reply.created_at)}</span>
                  </div>
                  <p className="note-content">{reply.content}</p>
                </div>
                {replyConfirmId === reply.id ? (
                  <span className="confirm-row">
                    <button className="text-btn text-btn-danger" onClick={() => onDelete(reply.id)}>Delete</button>
                    <button className="text-btn" onClick={() => setReplyConfirmId(null)}>Cancel</button>
                  </span>
                ) : (
                  <button className="icon-btn icon-btn-ghost" onClick={() => setReplyConfirmId(reply.id)} title="Delete reply">✕</button>
                )}
              </li>
            ))}
          </ul>
        )}

        {replyOpen ? (
          <form className="reply-composer" onSubmit={submitReply}>
            <input
              className="input"
              placeholder="Reply…"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              autoFocus
            />
            <button className="btn btn-primary" type="submit" disabled={submitting || !replyText.trim()}>
              Send
            </button>
            <button type="button" className="text-btn" onClick={() => setReplyOpen(false)}>Cancel</button>
          </form>
        ) : (
          <button className="text-btn thread-reply-btn" onClick={() => setReplyOpen(true)}>
            Reply
          </button>
        )}
      </div>
      <div className="note-actions">
        <button
          className={note.done ? 'check-btn check-btn-done' : 'check-btn'}
          onClick={() => onToggleDone(note)}
          title={note.done ? 'Mark as open' : 'Mark as done'}
        >
          {note.done ? '✓' : ''}
        </button>
        {confirming ? (
          <span className="confirm-row">
            <button className="text-btn text-btn-danger" onClick={() => onDelete(note.id)}>Delete</button>
            <button className="text-btn" onClick={() => setConfirming(false)}>Cancel</button>
          </span>
        ) : (
          <button className="icon-btn icon-btn-ghost" onClick={() => setConfirming(true)} title="Delete">✕</button>
        )}
      </div>
    </li>
  )
}
