#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST_PATH="${LO7_MANIFEST_PATH:-$ROOT/python-prototype/data/notebook.manifest.json}"

export PYTHONPATH="$ROOT/python-prototype/src"
export LO7_MANIFEST_PATH="$MANIFEST_PATH"

"$ROOT/python-prototype/.venv/bin/python" - <<'PY'
import os
from pathlib import Path

from notebook_engine.cli import build_service
from notebook_engine.blocks import BlockCreate

service = build_service(Path(os.environ['LO7_MANIFEST_PATH']), craft_required=False)
if not service.list_blocks():
    service.create_block(BlockCreate(min_col=2, max_col=6, min_row=2, max_row=6, label='Compass lane', tone='amber'))
    service.create_block(BlockCreate(min_col=8, max_col=13, min_row=4, max_row=9, label='Bridge payload', tone='mint'))
    service.create_block(BlockCreate(min_col=15, max_col=19, min_row=3, max_row=7, label='Heatmap', tone='azure'))
print(service.get_manifest().current_revision_id)
PY
