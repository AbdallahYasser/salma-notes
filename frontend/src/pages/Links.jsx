import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

function matches(topic, query) {
  const q = query.toLowerCase()
  if (topic.title.toLowerCase().includes(q)) return true
  return topic.links.some((l) => l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q))
}

function categoryTopics(categoryTitle, topicsInCategory, query) {
  if (!query) return topicsInCategory
  const q = query.toLowerCase()
  const titleMatches = categoryTitle != null && categoryTitle.toLowerCase().includes(q)
  if (titleMatches) return topicsInCategory
  return topicsInCategory.filter((t) => matches(t, query))
}

function categoryIsVisible(categoryTitle, topicsInCategory, query) {
  if (!query) return true
  const q = query.toLowerCase()
  if (categoryTitle != null && categoryTitle.toLowerCase().includes(q)) return true
  return topicsInCategory.some((t) => matches(t, query))
}

export default function Links() {
  const [topics, setTopics] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const [expandedIds, setExpandedIds] = useState(new Set())
  const [expandedCategoryIds, setExpandedCategoryIds] = useState(new Set())

  const [newCategoryTitle, setNewCategoryTitle] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [confirmCategoryId, setConfirmCategoryId] = useState(null)
  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [categoryTitleDraft, setCategoryTitleDraft] = useState('')

  const [newTopicTitle, setNewTopicTitle] = useState('')
  const [newTopicCategoryId, setNewTopicCategoryId] = useState('')
  const [addingTopic, setAddingTopic] = useState(false)
  const [confirmTopicId, setConfirmTopicId] = useState(null)
  const [addingLinkTopicId, setAddingLinkTopicId] = useState(null)
  const [linkDrafts, setLinkDrafts] = useState({})
  const [linkFormErrors, setLinkFormErrors] = useState({})
  const [editingTopicId, setEditingTopicId] = useState(null)
  const [topicTitleDraft, setTopicTitleDraft] = useState('')
  const [topicCategoryDraft, setTopicCategoryDraft] = useState('')
  const [editingLinkId, setEditingLinkId] = useState(null)
  const [linkEditDraft, setLinkEditDraft] = useState({ title: '', url: '' })
  const [linkEditError, setLinkEditError] = useState(null)

  useEffect(() => {
    Promise.all([api.listTopics(), api.listCategories()])
      .then(([topicsRes, categoriesRes]) => {
        setTopics(topicsRes.rows)
        setCategories(categoriesRes.rows)
      })
      .finally(() => setLoading(false))
  }, [])

  const searching = query.trim().length > 0
  const trimmedQuery = query.trim()

  const topicsByCategory = useMemo(() => {
    const map = new Map()
    for (const t of topics) {
      const key = t.category_id ?? null
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(t)
    }
    return map
  }, [topics])

  const groups = useMemo(() => {
    const categoryGroups = categories.map((c) => ({
      key: c.id,
      id: c.id,
      title: c.title,
      isUncategorized: false,
      allTopics: topicsByCategory.get(c.id) || [],
    }))
    const uncategorizedTopics = topicsByCategory.get(null) || []
    return [
      ...categoryGroups,
      {
        key: 'uncategorized',
        id: null,
        title: null,
        isUncategorized: true,
        allTopics: uncategorizedTopics,
      },
    ]
  }, [categories, topicsByCategory])

  const visibleGroups = useMemo(() => {
    return groups
      .filter((g) => (g.isUncategorized ? g.allTopics.length > 0 : true))
      .filter((g) => categoryIsVisible(g.title, g.allTopics, trimmedQuery))
  }, [groups, trimmedQuery])

  const isExpanded = (topicId) => searching || expandedIds.has(topicId)
  const isCategoryExpanded = (key) => searching || expandedCategoryIds.has(key)

  const toggleExpand = (topicId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })
  }

  const toggleCategoryExpand = (key) => {
    setExpandedCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const draftFor = (topicId) => linkDrafts[topicId] || { title: '', url: '' }
  const setDraft = (topicId, patch) =>
    setLinkDrafts((prev) => ({ ...prev, [topicId]: { ...draftFor(topicId), ...patch } }))

  const addCategory = async (e) => {
    e.preventDefault()
    const title = newCategoryTitle.trim()
    if (!title) return
    setAddingCategory(true)
    try {
      const category = await api.createCategory(title)
      setCategories((prev) => [category, ...prev])
      setNewCategoryTitle('')
      setExpandedCategoryIds((prev) => new Set(prev).add(category.id))
    } finally {
      setAddingCategory(false)
    }
  }

  const removeCategory = async (id) => {
    await api.deleteCategory(id)
    setCategories((prev) => prev.filter((c) => c.id !== id))
    setTopics((prev) => prev.map((t) => (t.category_id === id ? { ...t, category_id: null } : t)))
    setConfirmCategoryId(null)
  }

  const startCategoryEdit = (category) => {
    setCategoryTitleDraft(category.title)
    setEditingCategoryId(category.id)
  }

  const saveCategoryEdit = async (e, categoryId) => {
    e.preventDefault()
    const title = categoryTitleDraft.trim()
    if (!title) return
    const updated = await api.updateCategory(categoryId, title)
    setCategories((prev) => prev.map((c) => (c.id === categoryId ? { ...c, title: updated.title } : c)))
    setEditingCategoryId(null)
  }

  const addTopic = async (e) => {
    e.preventDefault()
    const title = newTopicTitle.trim()
    if (!title) return
    const categoryId = newTopicCategoryId === '' ? null : Number(newTopicCategoryId)
    setAddingTopic(true)
    try {
      const topic = await api.createTopic(title, categoryId)
      setTopics((prev) => [topic, ...prev])
      setNewTopicTitle('')
      setNewTopicCategoryId('')
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
    try {
      const link = await api.createLink(topicId, title, url)
      setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, links: [...t.links, link] } : t)))
      setLinkDrafts((prev) => ({ ...prev, [topicId]: { title: '', url: '' } }))
      setAddingLinkTopicId(null)
      setLinkFormErrors((prev) => ({ ...prev, [topicId]: null }))
    } catch (err) {
      if (err.status !== 409) throw err
      setLinkFormErrors((prev) => ({ ...prev, [topicId]: err.message }))
    }
  }

  const removeLink = async (topicId, linkId) => {
    await api.deleteLink(linkId)
    setTopics((prev) => prev.map((t) => (t.id === topicId ? { ...t, links: t.links.filter((l) => l.id !== linkId) } : t)))
  }

  const startTopicEdit = (topic) => {
    setTopicTitleDraft(topic.title)
    setTopicCategoryDraft(topic.category_id != null ? String(topic.category_id) : '')
    setEditingTopicId(topic.id)
  }

  const saveTopicEdit = async (e, topicId) => {
    e.preventDefault()
    const title = topicTitleDraft.trim()
    if (!title) return
    const categoryId = topicCategoryDraft === '' ? null : Number(topicCategoryDraft)
    const updated = await api.updateTopic(topicId, title, categoryId)
    setTopics((prev) => prev.map((t) => (
      t.id === topicId ? { ...t, title: updated.title, category_id: updated.category_id } : t
    )))
    setEditingTopicId(null)
  }

  const startLinkEdit = (link) => {
    setLinkEditDraft({ title: link.title, url: link.url })
    setLinkEditError(null)
    setEditingLinkId(link.id)
  }

  const saveLinkEdit = async (e, topicId, linkId) => {
    e.preventDefault()
    const title = linkEditDraft.title.trim()
    const url = linkEditDraft.url.trim()
    if (!title || !url) return
    try {
      const updated = await api.updateLink(linkId, title, url)
      setTopics((prev) => prev.map((t) => (
        t.id === topicId ? { ...t, links: t.links.map((l) => (l.id === linkId ? updated : l)) } : t
      )))
      setEditingLinkId(null)
      setLinkEditError(null)
    } catch (err) {
      if (err.status !== 409) throw err
      setLinkEditError(err.message)
    }
  }

  const renderTopic = (topic) => {
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
              <select
                className="input topic-category-select"
                value={topicCategoryDraft}
                onChange={(e) => setTopicCategoryDraft(e.target.value)}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
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
                        <button type="button" className="text-btn" onClick={() => { setEditingLinkId(null); setLinkEditError(null) }}>Cancel</button>
                        {linkEditError && <p className="link-form-error">{linkEditError}</p>}
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
                <button type="button" className="text-btn" onClick={() => {
                  setAddingLinkTopicId(null)
                  setLinkFormErrors((prev) => ({ ...prev, [topic.id]: null }))
                }}>Cancel</button>
                {linkFormErrors[topic.id] && <p className="link-form-error">{linkFormErrors[topic.id]}</p>}
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
  }

  const hasNothingYet = topics.length === 0 && categories.length === 0

  return (
    <>
      <form className="composer" onSubmit={addCategory}>
        <input
          className="input"
          placeholder="New category, e.g. “Kitchen”…"
          value={newCategoryTitle}
          onChange={(e) => setNewCategoryTitle(e.target.value)}
        />
        <div className="composer-row">
          <button className="btn btn-primary composer-submit" type="submit" disabled={addingCategory || !newCategoryTitle.trim()}>
            Add category
          </button>
        </div>
      </form>

      <form className="composer" onSubmit={addTopic}>
        <input
          className="input"
          placeholder="New topic, e.g. “Wedding planning”…"
          value={newTopicTitle}
          onChange={(e) => setNewTopicTitle(e.target.value)}
        />
        <div className="composer-row">
          <select
            className="input topic-category-select"
            value={newTopicCategoryId}
            onChange={(e) => setNewTopicCategoryId(e.target.value)}
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
          <button className="btn btn-primary composer-submit" type="submit" disabled={addingTopic || !newTopicTitle.trim()}>
            Add topic
          </button>
        </div>
      </form>

      {!hasNothingYet && (
        <input
          className="input topic-search"
          placeholder="Search categories, topics, and links…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : hasNothingYet ? (
        <div className="empty-state">
          <p>No topics yet.</p>
          <p className="empty-sub">Add one above to start collecting links.</p>
        </div>
      ) : searching && visibleGroups.length === 0 ? (
        <div className="empty-state">
          <p>No matches for “{trimmedQuery}”.</p>
        </div>
      ) : (
        <ul className="category-list">
          {visibleGroups.map((group) => {
            const expanded = isCategoryExpanded(group.key)
            const topicsToShow = categoryTopics(group.title, group.allTopics, trimmedQuery)
            return (
              <li
                key={group.key}
                className={group.isUncategorized ? 'category-card uncategorized-card' : 'category-card'}
              >
                <div className="category-header">
                  {!group.isUncategorized && editingCategoryId === group.id ? (
                    <form className="category-edit-composer" onSubmit={(e) => saveCategoryEdit(e, group.id)}>
                      <input
                        className="input"
                        value={categoryTitleDraft}
                        onChange={(e) => setCategoryTitleDraft(e.target.value)}
                        autoFocus
                      />
                      <button className="btn btn-primary" type="submit" disabled={!categoryTitleDraft.trim()}>Save</button>
                      <button type="button" className="text-btn" onClick={() => setEditingCategoryId(null)}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <button className="category-toggle" onClick={() => toggleCategoryExpand(group.key)}>
                        <span className={expanded ? 'category-caret category-caret-open' : 'category-caret'}>▸</span>
                        <h3 className="category-title">{group.isUncategorized ? 'Uncategorized' : group.title}</h3>
                        <span className="category-count">{group.allTopics.length}</span>
                      </button>
                      {!group.isUncategorized && (
                        confirmCategoryId === group.id ? (
                          <span className="confirm-row">
                            <button className="text-btn text-btn-danger" onClick={() => removeCategory(group.id)}>Delete</button>
                            <button className="text-btn" onClick={() => setConfirmCategoryId(null)}>Cancel</button>
                          </span>
                        ) : (
                          <span className="confirm-row">
                            <button className="icon-btn icon-btn-ghost icon-btn-edit" onClick={() => startCategoryEdit(group)} title="Edit category">✎</button>
                            <button className="icon-btn icon-btn-ghost" onClick={() => setConfirmCategoryId(group.id)} title="Delete category">✕</button>
                          </span>
                        )
                      )}
                    </>
                  )}
                </div>

                {!group.isUncategorized && confirmCategoryId === group.id && (
                  <p className="category-delete-note">
                    This won't delete its {group.allTopics.length} topic{group.allTopics.length === 1 ? '' : 's'} — they'll move to Uncategorized.
                  </p>
                )}

                {expanded && (
                  <div className="category-topics">
                    {topicsToShow.length === 0 ? (
                      <p className="empty-sub">No topics here yet.</p>
                    ) : (
                      <ul className="topic-list">
                        {topicsToShow.map((topic) => renderTopic(topic))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
