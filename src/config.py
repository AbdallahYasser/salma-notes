import os

APP_PASSWORD = os.environ.get("APP_PASSWORD")
SECRET_KEY = os.environ.get("SECRET_KEY")
DB_PATH = os.environ.get("DB_PATH", "./data/notes.db")
NAMES = [n.strip() for n in os.environ.get("NAMES", "Me,Friend").split(",") if n.strip()]
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
SESSION_DAYS = int(os.environ.get("SESSION_DAYS", "180"))

# Cloudflare R2 (S3-compatible) storage for Memory-page photos. Optional -
# if unset, text-only memories still work but photo uploads fail with a
# clear error instead of the app crashing at startup. See src/storage.py.
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET = os.environ.get("R2_BUCKET", "salma-notes-memories")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable must be set")
if not APP_PASSWORD:
    raise RuntimeError("APP_PASSWORD environment variable must be set")
