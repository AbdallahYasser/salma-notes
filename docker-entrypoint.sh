#!/bin/sh
# Runs as root so it can fix ownership of the external named volume
# salma-notes-data mounted at /app/data, then drops to the unprivileged
# appuser. Idempotent.
# (The volume used to be Coolify-managed; since 2026-11-10 it is a plain
# external docker volume declared in ~/stack/docker-compose.yml on the server.)
set -e
mkdir -p /app/data
chown -R appuser:appuser /app/data
exec gosu appuser "$@"
