"""Tiny in-memory rate limiter - small two-person app, low volume."""
import time
from typing import Union

from fastapi import HTTPException

_BUCKETS: dict[tuple[str, str], list[float]] = {}


def rate_limit(scope: str, key_id: Union[str, int], *, max_per_minute: int = 20) -> None:
    key = (scope, str(key_id))
    now = time.time()
    cutoff = now - 60.0

    history = _BUCKETS.setdefault(key, [])
    while history and history[0] < cutoff:
        history.pop(0)
    if len(history) >= max_per_minute:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded ({max_per_minute}/min). Try again shortly.",
        )
    history.append(now)
