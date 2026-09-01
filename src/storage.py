"""Google Drive (OAuth, as the account owner) storage for memory photos.

A Google Cloud *service account* was tried first, but Google rejects any
file it creates in a personal ("My Drive") folder with a hard
`storageQuotaExceeded` error - service accounts have zero storage quota of
their own, and the Workspace-only workarounds (Shared Drives, domain-wide
delegation) don't exist for a personal Gmail account. See
https://developers.google.com/workspace/drive/api/guides/about-shareddrives.

So this uses a real OAuth refresh token obtained once via a one-time
browser consent (the account owner authorizing the "Salma Notes" OAuth
client for the narrow `drive.file` scope - only files this app creates,
nothing else in the Drive). The backend exchanges that refresh token for a
fresh access token before each Drive API call; uploaded files count
against the human account's own Drive quota, not any service identity's.

Photos are never served via a Drive share link - the app proxies every
request through GET /api/memories/{id}/photo (see src/main.py), gated by
the session cookie, so a photo is only ever visible to someone logged
into Salma Notes.
"""
import json

import requests
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from starlette.concurrency import run_in_threadpool

from src import config

_TOKEN_URI = "https://oauth2.googleapis.com/token"
_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files"
_FILES_URL = "https://www.googleapis.com/drive/v3/files"


def _configured() -> bool:
    return bool(
        config.GOOGLE_OAUTH_CLIENT_ID
        and config.GOOGLE_OAUTH_CLIENT_SECRET
        and config.GOOGLE_OAUTH_REFRESH_TOKEN
        and config.GOOGLE_DRIVE_FOLDER_ID
    )


def _access_token() -> str:
    if not _configured():
        raise RuntimeError(
            "Photo storage isn't set up yet (GOOGLE_OAUTH_CLIENT_ID / "
            "GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN / "
            "GOOGLE_DRIVE_FOLDER_ID are missing)"
        )
    creds = Credentials(
        token=None,
        refresh_token=config.GOOGLE_OAUTH_REFRESH_TOKEN,
        client_id=config.GOOGLE_OAUTH_CLIENT_ID,
        client_secret=config.GOOGLE_OAUTH_CLIENT_SECRET,
        token_uri=_TOKEN_URI,
    )
    creds.refresh(GoogleAuthRequest())
    return creds.token


def _upload_sync(name_hint: str, data: bytes, content_type: str) -> str:
    token = _access_token()
    metadata = {"name": name_hint, "parents": [config.GOOGLE_DRIVE_FOLDER_ID]}
    res = requests.post(
        f"{_UPLOAD_URL}?uploadType=multipart&fields=id",
        headers={"Authorization": f"Bearer {token}"},
        files={
            "metadata": ("metadata", json.dumps(metadata), "application/json; charset=UTF-8"),
            "file": (name_hint, data, content_type),
        },
        timeout=30,
    )
    res.raise_for_status()
    return res.json()["id"]


def _download_sync(file_id: str) -> tuple[bytes, str]:
    token = _access_token()
    headers = {"Authorization": f"Bearer {token}"}
    meta = requests.get(f"{_FILES_URL}/{file_id}?fields=mimeType", headers=headers, timeout=15)
    meta.raise_for_status()
    content_type = meta.json().get("mimeType") or "application/octet-stream"
    res = requests.get(f"{_FILES_URL}/{file_id}?alt=media", headers=headers, timeout=30)
    res.raise_for_status()
    return res.content, content_type


def _delete_sync(file_id: str) -> None:
    token = _access_token()
    res = requests.delete(f"{_FILES_URL}/{file_id}", headers={"Authorization": f"Bearer {token}"}, timeout=15)
    if res.status_code not in (200, 204, 404):
        res.raise_for_status()


async def upload(name_hint: str, data: bytes, content_type: str) -> str:
    """Uploads a photo and returns the Drive file id to store as its key."""
    return await run_in_threadpool(_upload_sync, name_hint, data, content_type)


async def download(key: str) -> tuple[bytes, str]:
    return await run_in_threadpool(_download_sync, key)


async def delete(key: str) -> None:
    if not _configured():
        return
    await run_in_threadpool(_delete_sync, key)
