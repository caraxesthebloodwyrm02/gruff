#!/usr/bin/env bash
# POST a proportion JSON file to the local gruff-echoes stub.
# Usage: ./push-proportion.sh path/to/proportion.json
# Env: PORT (default 8765), HOST (default 127.0.0.1)

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "usage: $0 <proportion.json>" >&2
  exit 1
fi

FILE=$1
if [[ ! -f "$FILE" ]]; then
  echo "error: file not found: $FILE" >&2
  exit 1
fi

HOST=${HOST:-127.0.0.1}
PORT=${PORT:-8765}

exec curl -sS -X POST "http://${HOST}:${PORT}/gruff/proportion" \
  -H 'Content-Type: application/json' \
  -d @"$FILE"
