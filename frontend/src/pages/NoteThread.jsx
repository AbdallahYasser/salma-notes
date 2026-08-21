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

export default function NoteThread({ note, replies, identity, onToggleDone, onDelete, onUpdate, onReplyAdded }) {
  const [confirming, setConfirming] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyConfirmId, setReplyConfirmId] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState(note.content)
  const [editRemindAt, setEditRemindAt] = useState(note.remind_at || '')
  const [savingEdit, setSavingEdit] = useState(false)

  const [replyEditId, setReplyEditId] = useState(null)
  const [replyEditText, setReplyEditText] = useState('')
  const [savingReplyEdit, setSavingReplyEdit] = useState(false)

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

  const startEdit = () => {
    setEditContent(note.content)
    setEditRemindAt(note.remind_at || '')
    setEditing(true)
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    const text = editContent.trim()
    if (!text) return
    setSavingEdit(true)
    try {
      await onUpdate(note.id, {
        content: text,
        remind_at: note.kind === 'reminder' && editRemindAt ? editRemindAt : null,
      })
      setEditing(false)
    } finally {
      setSavingEdit(false)
    }
  }

  const startReplyEdit = (reply) => {
    setReplyEditId(reply.id)
    setReplyEditText(reply.content)
  }

  const saveReplyEdit = async (e) => {
    e.preventDefault()
    const text = replyEditText.trim()
    if (!text) return
    setSavingReplyEdit(true)
    try {
      await onUpdate(replyEditId, { content: text })
      setReplyEditId(null)
    } finally {
      setSavingReplyEdit(false)
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
        {editing ? (
          <form className="edit-composer" onSubmit={saveEdit}>
            <textarea
              className="input edit-textarea"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={2}
              autoFocus
            />
            {note.kind === 'reminder' && (
              <input
                type="date"
                className="input input-date"
                value={editRemindAt}
                onChange={(e) => setEditRemindAt(e.target.value)}
              />
            )}
            <div className="edit-composer-actions">
              <button className="btn btn-primary" type="submit" disabled={savingEdit || !editContent.trim()}>Save</button>
              <button type="button" className="text-btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
          <p className="note-content">{note.content}</p>
        )}

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
                  {replyEditId === reply.id ? (
                    <form className="reply-composer" onSubmit={saveReplyEdit}>
                      <input
                        className="input"
                        value={replyEditText}
                        onChange={(e) => setReplyEditText(e.target.value)}
                        autoFocus
                      />
                      <button className="btn btn-primary" type="submit" disabled={savingReplyEdit || !replyEditText.trim()}>Save</button>
                      <button type="button" className="text-btn" onClick={() => setReplyEditId(null)}>Cancel</button>
                    </form>
                  ) : (
                    <p className="note-content">{reply.content}</p>
                  )}
                </div>
                {replyEditId === reply.id ? null : replyConfirmId === reply.id ? (
                  <span className="confirm-row">
                    <button className="text-btn text-btn-danger" onClick={() => onDelete(reply.id)}>Delete</button>
                    <button className="text-btn" onClick={() => setReplyConfirmId(null)}>Cancel</button>
                  </span>
                ) : (
                  <span className="confirm-row">
                    <button className="icon-btn icon-btn-ghost icon-btn-edit" onClick={() => startReplyEdit(reply)} title="Edit reply">✎</button>
                    <button className="icon-btn icon-btn-ghost" onClick={() => setReplyConfirmId(reply.id)} title="Delete reply">✕</button>
                  </span>
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
          <>
            <button className="icon-btn icon-btn-ghost icon-btn-edit" onClick={startEdit} title="Edit">✎</button>
            <button className="icon-btn icon-btn-ghost" onClick={() => setConfirming(true)} title="Delete">✕</button>
          </>
        )}
      </div>
    </li>
  )
}
