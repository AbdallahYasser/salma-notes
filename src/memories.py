from src import storage
from src.db import get_db

_TRASH_RETENTION_DAYS = 30


async def list_memories() -> list[dict]:
    async with get_db() as db:
        cur = await db.execute("SELECT * FROM memories WHERE deleted_at IS NULL ORDER BY created_at DESC")
        return [dict(r) for r in await cur.fetchall()]


async def create_memory(author: str, content: str, photo_key: str | None = None) -> int:
    async with get_db() as db:
        cur = await db.execute(
            "INSERT INTO memories (author, content, photo_key) VALUES (?, ?, ?)",
            (author, content, photo_key),
        )
        await db.commit()
        return cur.lastrowid


async def get_memory(memory_id: int) -> dict | None:
    async with get_db() as db:
        cur = await db.execute("SELECT * FROM memories WHERE id = ?", (memory_id,))
        row = await cur.fetchone()
        return dict(row) if row else None


async def update_memory(memory_id: int, content: str) -> dict | None:
    async with get_db() as db:
        await db.execute(
            "UPDATE memories SET content = ?, updated_at = datetime('now') WHERE id = ?",
            (content, memory_id),
        )
        await db.commit()
    return await get_memory(memory_id)


async def delete_memory(memory_id: int) -> bool:
    async with get_db() as db:
        cur = await db.execute(
            "UPDATE memories SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
            (memory_id,),
        )
        await db.commit()
        return cur.rowcount > 0


async def list_deleted_memories() -> list[dict]:
    async with get_db() as db:
        cur = await db.execute(
            "SELECT photo_key FROM memories WHERE deleted_at IS NOT NULL "
            "AND deleted_at < datetime('now', ?) AND photo_key IS NOT NULL",
            (f"-{_TRASH_RETENTION_DAYS} days",),
        )
        expired_photo_keys = [row[0] for row in await cur.fetchall()]
        await db.execute(
            "DELETE FROM memories WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)",
            (f"-{_TRASH_RETENTION_DAYS} days",),
        )
        await db.commit()
        cur = await db.execute("SELECT * FROM memories WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
        rows = [dict(r) for r in await cur.fetchall()]
    # Purged rows' R2 objects aren't referenced by anything anymore - clean
    # them up so storage usage doesn't grow unbounded past the trash window.
    for key in expired_photo_keys:
        await storage.delete(key)
    return rows


async def restore_memory(memory_id: int) -> dict | None:
    async with get_db() as db:
        cur = await db.execute("UPDATE memories SET deleted_at = NULL WHERE id = ?", (memory_id,))
        await db.commit()
        if cur.rowcount == 0:
            return None
    return await get_memory(memory_id)
