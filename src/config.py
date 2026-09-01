import os

APP_PASSWORD = os.environ.get("APP_PASSWORD")
SECRET_KEY = os.environ.get("SECRET_KEY")
DB_PATH = os.environ.get("DB_PATH", "./data/notes.db")
NAMES = [n.strip() for n in os.environ.get("NAMES", "Me,Friend").split(",") if n.strip()]
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
SESSION_DAYS = int(os.environ.get("SESSION_DAYS", "180"))

# Google Drive (OAuth, as the account owner) storage for Memory-page
# photos. Optional - if unset, text-only memories still work but photo
# uploads fail with a clear error instead of the app crashing at startup.
# See src/storage.py for why this is OAuth-as-owner rather than a service
# account (service accounts can't write to personal Drive storage).
GOOGLE_OAUTH_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID")
GOOGLE_OAUTH_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET")
GOOGLE_OAUTH_REFRESH_TOKEN = os.environ.get("GOOGLE_OAUTH_REFRESH_TOKEN")
GOOGLE_DRIVE_FOLDER_ID = os.environ.get("GOOGLE_DRIVE_FOLDER_ID")

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable must be set")
if not APP_PASSWORD:
    raise RuntimeError("APP_PASSWORD environment variable must be set")
