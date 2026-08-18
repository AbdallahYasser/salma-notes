#!/bin/sh
# Runs as root so it can fix ownership of the Coolify-managed named volume
# mounted at /app/data, then drops to the unprivileged appuser. Idempotent.
set -e
mkdir -p /app/data
chown -R appuser:appuser /app/data
exec gosu appuser "$@"
