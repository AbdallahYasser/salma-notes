"""Auth: single shared password -> JWT session cookie.

No per-user accounts by design (two-person private notepad). "Who wrote
this note" is a free-text `author` field the client sends, chosen once from
`config.NAMES` and remembered in the browser's localStorage — not tied to
the session/cookie, which is shared by both people on purpose.

The password itself lives in the `settings` table (see src/settings.py),
not just the `APP_PASSWORD` env var, so it can be changed from inside the
app without a redeploy. `APP_PASSWORD` only matters as the bootstrap value
the first time the database is created (see main.py startup).
"""
import hashlib
import hmac
import os
import time

import jwt
from fastapi import Cookie, HTTPException

from src import config

COOKIE_NAME = "session"
_PBKDF2_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt_hex, digest_hex = stored_hash.split("$")
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    expected = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERATIONS)
    return hmac.compare_digest(expected.hex(), digest_hex)


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
