from contextlib import asynccontextmanager
from pathlib import Path

import aiosqlite

from src import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT NOT NULL,
    content TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'note' CHECK(kind IN ('note','reminder')),
    remind_at TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    parent_id INTEGER REFERENCES notes(id)
);
CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER NOT NULL REFERENCES topics(id),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_links_topic ON links(topic_id);
"""


async def apply_migrations() -> None:
    Path(config.DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(config.DB_PATH) as db:
        await db.executescript(SCHEMA)
        # `parent_id` was added after notes already existed in production -
        # CREATE TABLE IF NOT EXISTS above doesn't retrofit existing tables,
        # so add the column by hand for databases created before this.
        cur = await db.execute("PRAGMA table_info(notes)")
        columns = {row[1] for row in await cur.fetchall()}
        if "parent_id" not in columns:
            await db.execute("ALTER TABLE notes ADD COLUMN parent_id INTEGER REFERENCES notes(id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_notes_parent ON notes(parent_id)")

        # `category_id` was added after topics already existed in production -
        # same retrofit as `parent_id` above.
        cur = await db.execute("PRAGMA table_info(topics)")
        columns = {row[1] for row in await cur.fetchall()}
        if "category_id" not in columns:
            await db.execute("ALTER TABLE topics ADD COLUMN category_id INTEGER REFERENCES categories(id)")
        await db.execute("CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category_id)")

        await db.commit()


@asynccontextmanager
async def get_db():
    async with aiosqlite.connect(config.DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA busy_timeout=5000")
        yield db
