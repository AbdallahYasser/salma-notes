"""Cloudflare R2 (S3-compatible) object storage for memory photos.

Photos are never served from R2's own public URL - the app proxies every
request through GET /api/memories/{id}/photo (see src/main.py), gated by
the same session cookie as the rest of the app, so a photo is only visible
to someone already logged into Salma Notes. The actual bytes live in R2,
decoupled from the EC2 box the app runs on, so the server dying doesn't
take the photos with it.
"""
import boto3
from botocore.config import Config as BotoConfig
from starlette.concurrency import run_in_threadpool

from src import config


def _configured() -> bool:
    return bool(config.R2_ACCOUNT_ID and config.R2_ACCESS_KEY_ID and config.R2_SECRET_ACCESS_KEY)


def _client():
    if not _configured():
        raise RuntimeError(
            "Photo storage isn't set up yet (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / "
            "R2_SECRET_ACCESS_KEY are missing)"
        )
    return boto3.client(
        "s3",
        endpoint_url=f"https://{config.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=config.R2_ACCESS_KEY_ID,
        aws_secret_access_key=config.R2_SECRET_ACCESS_KEY,
        config=BotoConfig(signature_version="s3v4"),
        region_name="auto",
    )


async def upload(key: str, data: bytes, content_type: str) -> None:
    client = _client()
    await run_in_threadpool(
        client.put_object, Bucket=config.R2_BUCKET, Key=key, Body=data, ContentType=content_type,
    )


async def download(key: str) -> tuple[bytes, str]:
    client = _client()
    obj = await run_in_threadpool(client.get_object, Bucket=config.R2_BUCKET, Key=key)
    body = await run_in_threadpool(obj["Body"].read)
    return body, obj.get("ContentType") or "application/octet-stream"


async def delete(key: str) -> None:
    if not _configured():
        return
    client = _client()
    await run_in_threadpool(client.delete_object, Bucket=config.R2_BUCKET, Key=key)
