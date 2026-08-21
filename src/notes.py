from src.db import get_db

_ALLOWED_UPDATE_FIELDS = {"content", "kind", "remind_at", "done"}
_TRASH_RETENTION_DAYS = 30


async def list_notes() -> list[dict]:
    async with get_db() as db:
        cur = await db.execute("SELECT * FROM notes WHERE deleted_at IS NULL ORDER BY created_at DESC")
        rows = await cur.fetchall()
        return [dict(r) for r in rows]


async def create_note(author: str, content: str, kind: str = "note",
                      remind_at: str | None = None, parent_id: int | None = None) -> int:
    async with get_db() as db:
        cur = await db.execute(
            "INSERT INTO notes (author, content, kind, remind_at, parent_id) VALUES (?, ?, ?, ?, ?)",
            (author, content, kind, remind_at, parent_id),
        )
        await db.commit()
        return cur.lastrowid


async def update_note(note_id: int, **fields) -> dict | None:
    sets, values = [], []
    for key, value in fields.items():
        if key in _ALLOWED_UPDATE_FIELDS:
            sets.append(f"{key} = ?")
            values.append(value)
    if not sets:
        return await get_note(note_id)
    sets.append("updated_at = datetime('now')")
    values.append(note_id)
    async with get_db() as db:
        await db.execute(f"UPDATE notes SET {', '.join(sets)} WHERE id = ?", values)
        await db.commit()
    return await get_note(note_id)


async def get_note(note_id: int) -> dict | None:
    async with get_db() as db:
        cur = await db.execute("SELECT * FROM notes WHERE id = ?", (note_id,))
        row = await cur.fetchone()
        return dict(row) if row else None


async def delete_note(note_id: int) -> bool:
    async with get_db() as db:
        await db.execute(
            "UPDATE notes SET deleted_at = datetime('now') WHERE parent_id = ? AND deleted_at IS NULL",
            (note_id,),
        )
        cur = await db.execute(
            "UPDATE notes SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL",
            (note_id,),
        )
        await db.commit()
        return cur.rowcount > 0


async def list_deleted_notes() -> list[dict]:
    async with get_db() as db:
        await db.execute(
            "DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < datetime('now', ?)",
            (f"-{_TRASH_RETENTION_DAYS} days",),
        )
        await db.commit()
        cur = await db.execute("SELECT * FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC")
        return [dict(r) for r in await cur.fetchall()]


async def restore_note(note_id: int) -> dict | None:
    async with get_db() as db:
        await db.execute("UPDATE notes SET deleted_at = NULL WHERE parent_id = ?", (note_id,))
        cur = await db.execute("UPDATE notes SET deleted_at = NULL WHERE id = ?", (note_id,))
        await db.commit()
        if cur.rowcount == 0:
            return None
    return await get_note(note_id)
