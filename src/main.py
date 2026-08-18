"""Salma Notes - a tiny shared notepad for two people.

Auth: one shared password (env `APP_PASSWORD`) -> JWT session cookie, see
src/auth.py. No per-user accounts - "who wrote it" is a free-text `author`
field the client sends (chosen once from `config.NAMES`, remembered in
localStorage). Deliberately minimal: this is meant to grow more pages later,
not to become an ERP.
"""
import logging
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from src import auth, config, links as links_store, notes as notes_store, settings as app_settings
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


# ---------------------------------------------------------------------------
# Links (topics, each holding a list of titled links)
# ---------------------------------------------------------------------------
def _normalize_url(url: str) -> str:
    if not url.lower().startswith(("http://", "https://")):
        return f"https://{url}"
    return url


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
    topic_id = await links_store.create_topic(title)
    topic = await links_store.get_topic(topic_id)
    topic["links"] = []
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
    link_id = await links_store.create_link(topic_id, title, _normalize_url(url))
    return await links_store.get_link(link_id)


@app.delete("/api/links/{link_id}", status_code=204)
async def delete_link(link_id: int, request: Request, _: bool = Depends(auth.require_session)):
    rate_limit("write", request.client.host if request.client else "unknown")
    if not await links_store.delete_link(link_id):
        raise HTTPException(status_code=404, detail="Not found")
    return Response(status_code=204)


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
        response.headers["Cache-Control"] = "no-store"
        return response


if STATIC_DIR.exists():
    app.mount("/", NoCacheStaticFiles(directory=str(STATIC_DIR), html=True), name="static")
