import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

function matches(topic, query) {
  const q = query.toLowerCase()
  if (topic.title.toLowerCase().includes(q)) return true
  return topic.links.some((l) => l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q))
}

export default function Links() {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [confirmTopicId, setConfirmTopicId] = useState(null)
  const [addingLinkTopicId, setAddingLinkTopicId] = useState(null)
  const [linkDrafts, setLinkDrafts] = useState({})
  const [editingTopicId, setEditingTopicId] = useState(null)
  const [topicTitleDraft, setTopicTitleDraft] = useState('')
  const [editingLinkId, setEditingLinkId] = useState(null)
  const [linkEditDraft, setLinkEditDraft] = useState({ title: '', url: '' })

  useEffect(() => {
    api.listTopics().then((data) => setTopics(data.rows)).finally(() => setLoading(false))
  }, [])

  const searching = query.trim().length > 0

  const filteredTopics = useMemo(() => {
    if (!searching) return topics
    return topics.filter((t) => matches(t, query.trim()))
  }, [topics, query, searching])

  const isExpanded = (topicId) => searching || expandedIds.has(topicId)

  const toggleExpand = (topicId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })
  }

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
      setExpandedIds((prev) => new Set(prev).add(topic.id))
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

  const startTopicEdit = (topic) => {
    setTopicTitleDraft(topic.title)
    setEditingTopicId(topic.id)
  }

  const saveTopicEdit = async (e, topicId) => {
    e.preventDefault()
    const title = topicTitleDraft.trim()
    if (!title) return
    const updated = await api.updateTopic(topicId, title)
    setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, title: updated.title } : t)))
    setEditingTopicId(null)
  }

  const startLinkEdit = (link) => {
    setLinkEditDraft({ title: link.title, url: link.url })
    setEditingLinkId(link.id)
  }

  const saveLinkEdit = async (e, topicId, linkId) => {
    e.preventDefault()
    const title = linkEditDraft.title.trim()
    const url = linkEditDraft.url.trim()
    if (!title || !url) return
    const updated = await api.updateLink(linkId, title, url)
    setTopics((prev) => prev.map((t) => (
      t.id === topicId ? { ...t, links: t.links.map((l) => (l.id === linkId ? updated : l)) } : t
    )))
    setEditingLinkId(null)
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

      {topics.length > 0 && (
        <input
          className="input topic-search"
          placeholder="Search topics and links…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : topics.length === 0 ? (
        <div className="empty-state">
          <p>No topics yet.</p>
          <p className="empty-sub">Add one above to start collecting links.</p>
        </div>
      ) : filteredTopics.length === 0 ? (
        <div className="empty-state">
          <p>No matches for “{query.trim()}”.</p>
        </div>
      ) : (
        <ul className="topic-list">
          {filteredTopics.map((topic) => {
            const expanded = isExpanded(topic.id)
            return (
              <li key={topic.id} className="topic-card">
                <div className="topic-header">
                  {editingTopicId === topic.id ? (
                    <form className="topic-edit-composer" onSubmit={(e) => saveTopicEdit(e, topic.id)}>
                      <input
                        className="input"
                        value={topicTitleDraft}
                        onChange={(e) => setTopicTitleDraft(e.target.value)}
                        autoFocus
                      />
                      <button className="btn btn-primary" type="submit" disabled={!topicTitleDraft.trim()}>Save</button>
                      <button type="button" className="text-btn" onClick={() => setEditingTopicId(null)}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <button className="topic-toggle" onClick={() => toggleExpand(topic.id)}>
                        <span className={expanded ? 'topic-caret topic-caret-open' : 'topic-caret'}>▸</span>
                        <h3 className="topic-title">{topic.title}</h3>
                        <span className="topic-count">{topic.links.length}</span>
                      </button>
                      {confirmTopicId === topic.id ? (
                        <span className="confirm-row">
                          <button className="text-btn text-btn-danger" onClick={() => removeTopic(topic.id)}>Delete</button>
                          <button className="text-btn" onClick={() => setConfirmTopicId(null)}>Cancel</button>
                        </span>
                      ) : (
                        <span className="confirm-row">
                          <button className="icon-btn icon-btn-ghost icon-btn-edit" onClick={() => startTopicEdit(topic)} title="Edit topic">✎</button>
                          <button className="icon-btn icon-btn-ghost" onClick={() => setConfirmTopicId(topic.id)} title="Delete topic">✕</button>
                        </span>
                      )}
                    </>
                  )}
                </div>

                {expanded && (
                  <>
                    {topic.links.length > 0 && (
                      <ul className="link-list">
                        {topic.links.map((link) => (
                          <li key={link.id} className="link-item">
                            {editingLinkId === link.id ? (
                              <form className="link-composer" onSubmit={(e) => saveLinkEdit(e, topic.id, link.id)}>
                                <input
                                  className="input"
                                  placeholder="Link title"
                                  value={linkEditDraft.title}
                                  onChange={(e) => setLinkEditDraft((d) => ({ ...d, title: e.target.value }))}
                                  autoFocus
                                />
                                <input
                                  className="input"
                                  placeholder="https://…"
                                  value={linkEditDraft.url}
                                  onChange={(e) => setLinkEditDraft((d) => ({ ...d, url: e.target.value }))}
                                />
                                <button className="btn btn-primary" type="submit" disabled={!linkEditDraft.title.trim() || !linkEditDraft.url.trim()}>Save</button>
                                <button type="button" className="text-btn" onClick={() => setEditingLinkId(null)}>Cancel</button>
                              </form>
                            ) : (
                              <>
                                <a className="link-anchor" href={link.url} target="_blank" rel="noopener noreferrer">
                                  {link.title}
                                </a>
                                <span className="confirm-row">
                                  <button className="icon-btn icon-btn-ghost icon-btn-edit" onClick={() => startLinkEdit(link)} title="Edit link">✎</button>
                                  <button className="icon-btn icon-btn-ghost" onClick={() => removeLink(topic.id, link.id)} title="Delete link">✕</button>
                                </span>
                              </>
                            )}
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
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
