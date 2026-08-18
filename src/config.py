import os

APP_PASSWORD = os.environ.get("APP_PASSWORD")
SECRET_KEY = os.environ.get("SECRET_KEY")
DB_PATH = os.environ.get("DB_PATH", "./data/notes.db")
NAMES = [n.strip() for n in os.environ.get("NAMES", "Me,Friend").split(",") if n.strip()]
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
SESSION_DAYS = int(os.environ.get("SESSION_DAYS", "180"))

if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable must be set")
if not APP_PASSWORD:
    raise RuntimeError("APP_PASSWORD environment variable must be set")
