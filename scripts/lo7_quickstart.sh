#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST_PATH="${LO7_MANIFEST_PATH:-$ROOT/python-prototype/data/notebook.manifest.json}"

"$ROOT/scripts/lo7_generate.sh"
cd "$ROOT/python-prototype"
uv run lo7-manifest --manifest-path "$MANIFEST_PATH" show --json
uv run lo7-heatmap --manifest-path "$MANIFEST_PATH" --output "$ROOT/python-prototype/data/heatmap.html" --json
