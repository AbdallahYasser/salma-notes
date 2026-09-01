"""Salma Notes - a tiny shared notepad for two people.

Auth: one shared password (env `APP_PASSWORD`) -> JWT session cookie, see
src/auth.py. No per-user accounts - "who wrote it" is a free-text `author`
field the client sends (chosen once from `config.NAMES`, remembered in
localStorage). Deliberately minimal: this is meant to grow more pages later,
not to become an ERP.
"""
import logging
import mimetypes
import uuid
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from src import (
    auth, config, links as links_store, memories as memories_store, notes as notes_store,
    settings as app_settings, storage,
)
from src.db import apply_migrations
from src.middleware import rate_limit

logging.basicConfig(
    level=getattr(logging, config.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(docs_url=None, redoc_url=None)
STATIC_DIR = Path(__file__).parent / "static"

PASSWORD_HASH_KEY = "password_hash"


@app.on_event("startup")
async def _startup():
    await apply_migrations()
    if await app_settings.get_setting(PASSWORD_HASH_KEY) is None:
        await app_settings.set_setting(PASSWORD_HASH_KEY, auth.hash_password(config.APP_PASSWORD))


# ---------------------------------------------------------------------------
# Health (unauthenticated)
# ---------------------------------------------------------------------------
@app.get("/api/health")
async def health():
    return {"ok": True}


@app.get("/privacy", response_class=Response)
async def privacy_policy():
    """Unauthenticated static page - required by Google's OAuth consent
    screen for the Drive integration backing Memory-page photo uploads
    (see src/storage.py). Two people, no data shared with anyone else."""
    html = """<!doctype html><html><head><title>Salma Notes - Privacy</title>
    <meta name="viewport" content="width=device-width, initial-scale=1"></head>
    <body style="font-family: system-ui, sans-serif; max-width: 640px; margin: 40px auto; padding: 0 16px; line-height: 1.6;">
    <h1>Privacy</h1>
    <p>Salma Notes is a private notepad shared between two people. It is not
    a public product and collects no data from anyone else.</p>
    <p>Notes, reminders, links, and memory photos are stored only to provide
    the app's own features to its two users, and are never sold, shared, or
    used for advertising.</p>
    <p>Memory-page photos are stored in a personal Google Drive folder via
    the Google Drive API, solely so the app can save and display them back
    to its two users. The app does not access any other files in that
    Drive account.</p>
    </body></html>"""
    return Response(content=html, media_type="text/html")


@app.get("/api/config")
async def api_config():
    return {"names": config.NAMES}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
@app.post("/api/auth/login")
async def login(request: Request, response: Response):
    rate_limit("login", request.client.host if request.client else "unknown", max_per_minute=10)
    body = await request.json()
    password = (body.get("password") or "").strip()
    stored_hash = await app_settings.get_setting(PASSWORD_HASH_KEY)
    if not stored_hash or not auth.verify_password(password, stored_hash):
        raise HTTPException(status_code=403, detail="Wrong password")
    token = auth.create_session_token()
    response.set_cookie(
        key=auth.COOKIE_NAME, value=token, httponly=True, secure=True,
        samesite="lax", max_age=config.SESSION_DAYS * 86400,
    )
    return {"ok": True}


@app.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie(auth.COOKIE_NAME)
    return {"ok": True}


@app.get("/api/auth/me")
async def me(_: bool = Depends(auth.require_session)):
    return {"ok": True}


@app.put("/api/auth/password")
async def change_password(request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("password-change", request.client.host if request.client else "unknown", max_per_minute=5)
    body = await request.json()
    current_password = (body.get("current_password") or "").strip()
    new_password = (body.get("new_password") or "").strip()
    if len(new_password) < 4:
        raise HTTPException(status_code=400, detail="New password must be at least 4 characters")
    stored_hash = await app_settings.get_setting(PASSWORD_HASH_KEY)
    if not stored_hash or not auth.verify_password(current_password, stored_hash):
        raise HTTPException(status_code=403, detail="Current password is wrong")
    await app_settings.set_setting(PASSWORD_HASH_KEY, auth.hash_password(new_password))
    return {"ok": True}


# ---------------------------------------------------------------------------
# Notes
# ---------------------------------------------------------------------------
@app.get("/api/notes")
async def list_notes(_: bool = Depends(auth.require_session)):
    return {"rows": await notes_store.list_notes()}


@app.post("/api/notes", status_code=201)
async def create_note(request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    body = await request.json()
    content = (body.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content is required")
    author = (body.get("author") or "").strip() or (config.NAMES[0] if config.NAMES else "Someone")

    parent_id = body.get("parent_id")
    if parent_id is not None:
        parent = await notes_store.get_note(parent_id)
        if parent is None:
            raise HTTPException(status_code=404, detail="Note being replied to was not found")
        if parent["parent_id"] is not None:
            raise HTTPException(status_code=400, detail="Can't reply to a reply")
        # Replies are plain messages in a thread, not their own reminder/task.
        kind, remind_at = "note", None
    else:
        kind = body.get("kind") if body.get("kind") in ("note", "reminder") else "note"
        remind_at = body.get("remind_at") or None

    note_id = await notes_store.create_note(author, content, kind, remind_at, parent_id)
    return await notes_store.get_note(note_id)


@app.put("/api/notes/{note_id}")
async def update_note(note_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    body = await request.json()
    row = await notes_store.update_note(note_id, **body)
    if row is None:
        raise HTTPException(status_code=404, detail="Not found")
    return row


@app.delete("/api/notes/{note_id}", status_code=204)
async def delete_note(note_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    if not await notes_store.delete_note(note_id):
        raise HTTPException(status_code=404, detail="Not found")
    return Response(status_code=204)


@app.post("/api/notes/{note_id}/restore")
async def restore_note(note_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    note = await notes_store.restore_note(note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Not found")
    return note


# ---------------------------------------------------------------------------
# Links (topics, each holding a list of titled links)
# ---------------------------------------------------------------------------
def _normalize_url(url: str) -> str:
    if not url.lower().startswith(("http://", "https://")):
        return f"https://{url}"
    return url


def _duplicate_link_detail(existing: dict) -> str:
    location = existing["topic_title"]
    if existing["category_title"]:
        location += f' ({existing["category_title"]})'
    return f'This link already exists in "{location}"'


@app.get("/api/categories")
async def list_categories(_: bool = Depends(auth.require_session)):
    return {"rows": await links_store.list_categories()}


@app.post("/api/categories", status_code=201)
async def create_category(request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    body = await request.json()
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Category title is required")
    category_id = await links_store.create_category(title)
    return await links_store.get_category(category_id)


@app.put("/api/categories/{category_id}")
async def update_category(category_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    body = await request.json()
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Category title is required")
    category = await links_store.update_category(category_id, title)
    if category is None:
        raise HTTPException(status_code=404, detail="Not found")
    return category


@app.delete("/api/categories/{category_id}", status_code=204)
async def delete_category(category_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    if not await links_store.delete_category(category_id):
        raise HTTPException(status_code=404, detail="Not found")
    return Response(status_code=204)


@app.get("/api/topics")
async def list_topics(_: bool = Depends(auth.require_session)):
    return {"rows": await links_store.list_topics_with_links()}


@app.post("/api/topics", status_code=201)
async def create_topic(request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    body = await request.json()
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Topic title is required")
    category_id = body.get("category_id")
    if category_id is not None and await links_store.get_category(category_id) is None:
        raise HTTPException(status_code=400, detail="Category not found")
    topic_id = await links_store.create_topic(title, category_id)
    topic = await links_store.get_topic(topic_id)
    topic["links"] = []
    return topic


@app.put("/api/topics/{topic_id}")
async def update_topic(topic_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    body = await request.json()
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Topic title is required")
    category_id = body.get("category_id")
    if category_id is not None and await links_store.get_category(category_id) is None:
        raise HTTPException(status_code=400, detail="Category not found")
    topic = await links_store.update_topic(topic_id, title, category_id)
    if topic is None:
        raise HTTPException(status_code=404, detail="Not found")
    return topic


@app.delete("/api/topics/{topic_id}", status_code=204)
async def delete_topic(topic_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    if not await links_store.delete_topic(topic_id):
        raise HTTPException(status_code=404, detail="Not found")
    return Response(status_code=204)


@app.post("/api/topics/{topic_id}/links", status_code=201)
async def create_link(topic_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    if await links_store.get_topic(topic_id) is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    body = await request.json()
    title = (body.get("title") or "").strip()
    url = (body.get("url") or "").strip()
    if not title or not url:
        raise HTTPException(status_code=400, detail="Link title and URL are required")
    normalized_url = _normalize_url(url)
    existing = await links_store.find_link_by_url(normalized_url)
    if existing is not None:
        raise HTTPException(status_code=409, detail=_duplicate_link_detail(existing))
    link_id = await links_store.create_link(topic_id, title, normalized_url)
    return await links_store.get_link(link_id)


@app.put("/api/links/{link_id}")
async def update_link(link_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    body = await request.json()
    title = (body.get("title") or "").strip()
    url = (body.get("url") or "").strip()
    if not title or not url:
        raise HTTPException(status_code=400, detail="Link title and URL are required")
    normalized_url = _normalize_url(url)
    existing = await links_store.find_link_by_url(normalized_url, exclude_link_id=link_id)
    if existing is not None:
        raise HTTPException(status_code=409, detail=_duplicate_link_detail(existing))
    link = await links_store.update_link(link_id, title, normalized_url)
    if link is None:
        raise HTTPException(status_code=404, detail="Not found")
    return link


@app.put("/api/links/{link_id}/watched")
async def set_link_watched(link_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    body = await request.json()
    watched = bool(body.get("watched"))
    link = await links_store.set_link_watched(link_id, watched)
    if link is None:
        raise HTTPException(status_code=404, detail="Not found")
    return link


@app.delete("/api/links/{link_id}", status_code=204)
async def delete_link(link_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    if not await links_store.delete_link(link_id):
        raise HTTPException(status_code=404, detail="Not found")
    return Response(status_code=204)


@app.post("/api/links/{link_id}/restore")
async def restore_link(link_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    link = await links_store.restore_link(link_id)
    if link is None:
        raise HTTPException(status_code=404, detail="Not found")
    return link


# ---------------------------------------------------------------------------
# Memories (a small note + optional photo, e.g. from a night out together)
# ---------------------------------------------------------------------------
_ALLOWED_PHOTO_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_MAX_PHOTO_BYTES = 15 * 1024 * 1024


def _memory_out(row: dict) -> dict:
    row = dict(row)
    photo_key = row.pop("photo_key", None)
    row["photo_url"] = f"/api/memories/{row['id']}/photo" if photo_key else None
    return row


@app.get("/api/memories")
async def list_memories(_: bool = Depends(auth.require_session)):
    rows = await memories_store.list_memories()
    return {"rows": [_memory_out(r) for r in rows]}


@app.post("/api/memories", status_code=201)
async def create_memory(
    request: Request,
    author: str = Form(""),
    content: str = Form(""),
    photo: UploadFile | None = File(None),
    _: bool = Depends(auth.require_session),
):
    rate_limit("write", request.client.host if request.client else "unknown")
    text = content.strip()
    has_photo = photo is not None and photo.filename
    if not text and not has_photo:
        raise HTTPException(status_code=400, detail="Write something or add a photo")
    resolved_author = author.strip() or (config.NAMES[0] if config.NAMES else "Someone")

    photo_key = None
    if has_photo:
        if photo.content_type not in _ALLOWED_PHOTO_TYPES:
            raise HTTPException(status_code=400, detail="Photo must be a JPEG, PNG, WEBP, or GIF image")
        data = await photo.read()
        if len(data) > _MAX_PHOTO_BYTES:
            raise HTTPException(status_code=400, detail="Photo is too large (max 15MB)")
        ext = mimetypes.guess_extension(photo.content_type) or ""
        name_hint = f"{uuid.uuid4().hex}{ext}"
        try:
            photo_key = await storage.upload(name_hint, data, photo.content_type)
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc

    memory_id = await memories_store.create_memory(resolved_author, text, photo_key)
    return _memory_out(await memories_store.get_memory(memory_id))


@app.put("/api/memories/{memory_id}")
async def update_memory(memory_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    body = await request.json()
    content = (body.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Memory text is required")
    memory = await memories_store.update_memory(memory_id, content)
    if memory is None:
        raise HTTPException(status_code=404, detail="Not found")
    return _memory_out(memory)


@app.delete("/api/memories/{memory_id}", status_code=204)
async def delete_memory(memory_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    if not await memories_store.delete_memory(memory_id):
        raise HTTPException(status_code=404, detail="Not found")
    return Response(status_code=204)


@app.post("/api/memories/{memory_id}/restore")
async def restore_memory(memory_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    memory = await memories_store.restore_memory(memory_id)
    if memory is None:
        raise HTTPException(status_code=404, detail="Not found")
    return _memory_out(memory)


@app.get("/api/memories/{memory_id}/photo")
async def get_memory_photo(memory_id: int, _: bool = Depends(auth.require_session)):
    memory = await memories_store.get_memory(memory_id)
    if memory is None or not memory.get("photo_key"):
        raise HTTPException(status_code=404, detail="Not found")
    try:
        data, content_type = await storage.download(memory["photo_key"])
    except Exception as exc:
        logger.warning("Failed to load memory photo %s: %s", memory_id, exc)
        raise HTTPException(status_code=502, detail="Could not load photo") from exc
    return Response(content=data, media_type=content_type, headers={"Cache-Control": "private, max-age=86400"})


# ---------------------------------------------------------------------------
# Trash (soft-deleted notes, reminders, links, and memories - kept 30 days)
# ---------------------------------------------------------------------------
@app.get("/api/trash")
async def get_trash(_: bool = Depends(auth.require_session)):
    return {
        "notes": await notes_store.list_deleted_notes(),
        "links": await links_store.list_deleted_links(),
        "memories": [_memory_out(m) for m in await memories_store.list_deleted_memories()],
    }


# ---------------------------------------------------------------------------
# Static file serving (Vite build output) - mounted LAST so /api/* above
# always takes precedence. Falls back to index.html for unknown paths so
# client-side routes survive a hard refresh (see perfume-erp for the same
# pattern and the bug it fixes).
# ---------------------------------------------------------------------------
class NoCacheStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404 or path.startswith("api/") or path == "api":
                raise
            response = await super().get_response("index.html", scope)
        # Vite hashes its output filenames (assets/index-<hash>.js), so those
        # are safe to cache forever - a rebuild ships under a new name.
        # index.html (and anything else, e.g. the SPA-fallback above) must
        # stay no-store or the browser/CDN would keep serving stale asset
        # references after a deploy.
        if path.startswith("assets/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "no-store"
        return response


if STATIC_DIR.exists():
    app.mount("/", NoCacheStaticFiles(directory=str(STATIC_DIR), html=True), name="static")
