import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Links() {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [confirmTopicId, setConfirmTopicId] = useState(null)
  const [addingLinkTopicId, setAddingLinkTopicId] = useState(null)
  const [linkDrafts, setLinkDrafts] = useState({})

  useEffect(() => {
    api.listTopics().then((data) => setTopics(data.rows)).finally(() => setLoading(false))
  }, [])

  const draftFor = (topicId) => linkDrafts[topicId] || { title: '', url: '' }
  const setDraft = (topicId, patch) =>
    setLinkDrafts((prev) => ({ ...prev, [topicId]: { ...draftFor(topicId), ...patch } }))

  const addTopic = async (e) => {
    e.preventDefault()
    const title = newTopicTitle.trim()
    if (!title) return
    setAddingTopic(true)
    try {
      const topic = await api.createTopic(title)
      setTopics((prev) => [topic, ...prev])
      setNewTopicTitle('')
    } finally {
      setAddingTopic(false)
    }
  }

  const removeTopic = async (id) => {
    await api.deleteTopic(id)
    setTopics((prev) => prev.filter((t) => t.id !== id))
    setConfirmTopicId(null)
  }

  const addLink = async (e, topicId) => {
    e.preventDefault()
    const draft = draftFor(topicId)
    const title = draft.title.trim()
    const url = draft.url.trim()
    if (!title || !url) return
    const link = await api.createLink(topicId, title, url)
    setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, links: [...t.links, link] } : t)))
    setLinkDrafts((prev) => ({ ...prev, [topicId]: { title: '', url: '' } }))
    setAddingLinkTopicId(null)
  }

  const removeLink = async (topicId, linkId) => {
    await api.deleteLink(linkId)
    setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, links: t.links.filter((l) => l.id !== linkId) } : t)))
  }

  return (
    <>
      <form className="composer" onSubmit={addTopic}>
        <input
          className="input"
          placeholder="New topic, e.g. “Wedding planning”…"
          value={newTopicTitle}
          onChange={(e) => setNewTopicTitle(e.target.value)}
        />
        <div className="composer-row">
          <button className="btn btn-primary composer-submit" type="submit" disabled={addingTopic || !newTopicTitle.trim()}>
            Add topic
          </button>
        </div>
      </form>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : topics.length === 0 ? (
        <div className="empty-state">
          <p>No topics yet.</p>
          <p className="empty-sub">Add one above to start collecting links.</p>
        </div>
      ) : (
        <ul className="topic-list">
          {topics.map((topic) => (
            <li key={topic.id} className="topic-card">
              <div className="topic-header">
                <h3 className="topic-title">{topic.title}</h3>
                {confirmTopicId === topic.id ? (
                  <span className="confirm-row">
                    <button className="text-btn text-btn-danger" onClick={() => removeTopic(topic.id)}>Delete</button>
                    <button className="text-btn" onClick={() => setConfirmTopicId(null)}>Cancel</button>
                  </span>
                ) : (
                  <button className="icon-btn icon-btn-ghost" onClick={() => setConfirmTopicId(topic.id)} title="Delete topic">✕</button>
                )}
              </div>

              {topic.links.length > 0 && (
                <ul className="link-list">
                  {topic.links.map((link) => (
                    <li key={link.id} className="link-item">
                      <a className="link-anchor" href={link.url} target="_blank" rel="noopener noreferrer">
                        {link.title}
                      </a>
                      <button className="icon-btn icon-btn-ghost" onClick={() => removeLink(topic.id, link.id)} title="Delete link">✕</button>
                    </li>
                  ))}
                </ul>
              )}

              {addingLinkTopicId === topic.id ? (
                <form className="link-composer" onSubmit={(e) => addLink(e, topic.id)}>
                  <input
                    className="input"
                    placeholder="Link title"
                    value={draftFor(topic.id).title}
                    onChange={(e) => setDraft(topic.id, { title: e.target.value })}
                    autoFocus
                  />
                  <input
                    className="input"
                    placeholder="https://…"
                    value={draftFor(topic.id).url}
                    onChange={(e) => setDraft(topic.id, { url: e.target.value })}
                  />
                  <button className="btn btn-primary" type="submit" disabled={!draftFor(topic.id).title.trim() || !draftFor(topic.id).url.trim()}>
                    Add
                  </button>
                  <button type="button" className="text-btn" onClick={() => setAddingLinkTopicId(null)}>Cancel</button>
                </form>
              ) : (
                <button className="text-btn thread-reply-btn" onClick={() => setAddingLinkTopicId(topic.id)}>
                  + Add link
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
