from src.db import get_db


async def list_topics_with_links() -> list[dict]:
    async with get_db() as db:
        topics_cur = await db.execute("SELECT * FROM topics ORDER BY created_at DESC")
        topics = [dict(r) for r in await topics_cur.fetchall()]
        links_cur = await db.execute("SELECT * FROM links ORDER BY created_at ASC")
        links = [dict(r) for r in await links_cur.fetchall()]

    by_topic: dict[int, list] = {}
    for link in links:
        by_topic.setdefault(link["topic_id"], []).append(link)
    for topic in topics:
        topic["links"] = by_topic.get(topic["id"], [])
    return topics


async def create_topic(title: str) -> int:
    async with get_db() as db:
        cur = await db.execute("INSERT INTO topics (title) VALUES (?)", (title,))
        await db.commit()
        return cur.lastrowid


async def get_topic(topic_id: int) -> dict | None:
    async with get_db() as db:
        cur = await db.execute("SELECT * FROM topics WHERE id = ?", (topic_id,))
        row = await cur.fetchone()
        return dict(row) if row else None


async def delete_topic(topic_id: int) -> bool:
    async with get_db() as db:
        await db.execute("DELETE FROM links WHERE topic_id = ?", (topic_id,))
        cur = await db.execute("DELETE FROM topics WHERE id = ?", (topic_id,))
        await db.commit()
        return cur.rowcount > 0


async def create_link(topic_id: int, title: str, url: str) -> int:
    async with get_db() as db:
        cur = await db.execute(
            "INSERT INTO links (topic_id, title, url) VALUES (?, ?, ?)",
            (topic_id, title, url),
        )
        await db.commit()
        return cur.lastrowid


async def get_link(link_id: int) -> dict | None:
    async with get_db() as db:
        cur = await db.execute("SELECT * FROM links WHERE id = ?", (link_id,))
        row = await cur.fetchone()
        return dict(row) if row else None


async def delete_link(link_id: int) -> bool:
    async with get_db() as db:
        cur = await db.execute("DELETE FROM links WHERE id = ?", (link_id,))
        await db.commit()
        return cur.rowcount > 0
