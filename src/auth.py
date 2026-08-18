"""Auth: single shared password -> JWT session cookie.

No per-user accounts by design (two-person private notepad). "Who wrote
this note" is a free-text `author` field the client sends, chosen once from
`config.NAMES` and remembered in the browser's localStorage — not tied to
the session/cookie, which is shared by both people on purpose.
"""
import time

import jwt
from fastapi import Cookie, HTTPException

from src import config

COOKIE_NAME = "session"


def create_session_token() -> str:
    now = int(time.time())
    payload = {"iat": now, "exp": now + config.SESSION_DAYS * 86400, "sub": "shared"}
    return jwt.encode(payload, config.SECRET_KEY, algorithm="HS256")


def verify_session_token(token: str) -> bool:
    try:
        jwt.decode(token, config.SECRET_KEY, algorithms=["HS256"])
        return True
    except jwt.PyJWTError:
        return False


async def require_session(session: str | None = Cookie(default=None)) -> bool:
    if not session or not verify_session_token(session):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return True
