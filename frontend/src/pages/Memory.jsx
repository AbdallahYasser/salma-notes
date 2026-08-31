import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { colorFor } from '../colorFor.js'
import { formatWhen, formatDate } from '../formatWhen.js'

export default function Memory({ identity }) {
  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)

  const [content, setContent] = useState('')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [editContent, setEditContent] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  useEffect(() => {
    api.listMemories().then((data) => setMemories(data.rows)).finally(() => setLoading(false))
  }, [])

  const pickPhoto = (e) => {
    const file = e.target.files[0] || null
    setPhotoFile(file)
    setPhotoPreview(file ? URL.createObjectURL(file) : null)
  }

  const clearPhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    const text = content.trim()
    if (!text && !photoFile) return
    setSubmitting(true)
    setError(null)
    try {
      const memory = await api.createMemory(identity, text, photoFile)
      setMemories((prev) => [memory, ...prev])
      setContent('')
      clearPhoto()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const startEdit = (memory) => {
    setEditingId(memory.id)
    setEditContent(memory.content)
  }

  const saveEdit = async (e, id) => {
    e.preventDefault()
    const text = editContent.trim()
    if (!text) return
    const updated = await api.updateMemory(id, text)
    setMemories((prev) => prev.map((m) => (m.id === id ? updated : m)))
    setEditingId(null)
  }

  const removeMemory = async (id) => {
    await api.deleteMemory(id)
    setMemories((prev) => prev.filter((m) => m.id !== id))
    setConfirmId(null)
  }

  return (
    <>
      <form className="composer" onSubmit={submit}>
        <textarea
          className="composer-input"
          placeholder="What do you want to remember about today?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
        />
        <div className="composer-row">
          <label className="text-btn memory-photo-picker">
            {photoFile ? 'Change photo' : '+ Add photo'}
            <input type="file" accept="image/*" onChange={pickPhoto} hidden />
          </label>
          <button
            className="btn btn-primary composer-submit"
            type="submit"
            disabled={submitting || (!content.trim() && !photoFile)}
          >
            Add
          </button>
        </div>
        {photoPreview && (
          <div className="memory-photo-preview">
            <img src={photoPreview} alt="" />
            <button type="button" className="icon-btn icon-btn-ghost" onClick={clearPhoto} title="Remove photo">✕</button>
          </div>
        )}
        {error && <p className="link-form-error">{error}</p>}
      </form>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : memories.length === 0 ? (
        <div className="empty-state">
          <p>No memories yet.</p>
          <p className="empty-sub">Write the first one above.</p>
        </div>
      ) : (
        <ul className="memory-list">
          {memories.map((memory) => (
            <li key={memory.id} className="memory-card">
              <div className="note-meta">
                <span className="avatar avatar-sm" style={{ background: colorFor(memory.author) }}>
                  {memory.author.charAt(0).toUpperCase()}
                </span>
                <span className="note-author">{memory.author}</span>
                <span className="note-dot">·</span>
                <span className="note-time">{formatWhen(memory.created_at)}</span>
                <span className="note-dot">·</span>
                <span className="note-date">{formatDate(memory.created_at)}</span>
              </div>

              {memory.photo_url && (
                <img className="memory-photo" src={memory.photo_url} alt="" loading="lazy" />
              )}

              {editingId === memory.id ? (
                <form className="edit-composer" onSubmit={(e) => saveEdit(e, memory.id)}>
                  <textarea
                    className="input edit-textarea"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={2}
                    autoFocus
                  />
                  <div className="edit-composer-actions">
                    <button className="btn btn-primary" type="submit" disabled={!editContent.trim()}>Save</button>
                    <button type="button" className="text-btn" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </form>
              ) : (
                memory.content && <p className="note-content">{memory.content}</p>
              )}

              <div className="confirm-row memory-card-actions">
                {confirmId === memory.id ? (
                  <>
                    <button className="text-btn text-btn-danger" onClick={() => removeMemory(memory.id)}>Delete</button>
                    <button className="text-btn" onClick={() => setConfirmId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="icon-btn icon-btn-ghost icon-btn-edit" onClick={() => startEdit(memory)} title="Edit">✎</button>
                    <button className="icon-btn icon-btn-ghost" onClick={() => setConfirmId(memory.id)} title="Delete">✕</button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
