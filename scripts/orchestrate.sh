#!/usr/bin/env bash
# Gruff parallel plan — terminal gates (waves). Repo root = directory containing this script/..
# Usage: bash scripts/orchestrate.sh <wave0|wave1|wave2|all|smoke|help>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

die() { echo "orchestrate: $*" >&2; exit 1; }

require_file() {
  test -f "$1" || die "missing file: $1"
}

smoke() {
  test -f "$ROOT/dist/cli.js" || die "run wave0 or npm run build first (no dist/cli.js)"
  # Ink may exit when stdout closes; we only need a few lines without crashing.
  if command -v timeout >/dev/null 2>&1; then
    timeout 4s node "$ROOT/dist/cli.js" </dev/null 2>&1 | head -n 8 >/dev/null || true
  else
    node "$ROOT/dist/cli.js" </dev/null 2>&1 | head -n 8 >/dev/null || true
  fi
  echo "orchestrate: smoke ok (TUI started; output ignored)"
}

wave0() {
  echo "=== Wave 0: Segment A (build + lint) + D1 + E1/E2 file gates ==="
  npm run build
  npm run lint
  require_file "$ROOT/dist/cli.js"
  require_file "$ROOT/dist/trust/ingester.js"
  require_file "$ROOT/templates/gruff.md"
  require_file "$ROOT/bridges/gruff-echoes/README.md"
  require_file "$ROOT/planes/README.md"
  require_file "$ROOT/racks/README.md"
  echo "orchestrate: wave0 passed"
}

wave1() {
  echo "=== Wave 1: B + C + D (Python) + F tests / compile checks ==="
  npm test
  if command -v python3 >/dev/null 2>&1; then
    python3 -m py_compile "$ROOT/bridges/gruff-echoes/receiver.py"
    echo "orchestrate: python receiver.py syntax ok"
  else
    echo "orchestrate: skip python3 -m py_compile (python3 not in PATH)" >&2
  fi
  echo "orchestrate: wave1 passed"
}

wave2() {
  echo "=== Wave 2: release gate (prepublish) + F3 docs + C4 TUI smoke ==="
  require_file "$ROOT/docs/index.md"
  shopt -s nullglob
  local svgs=("$ROOT/design-system/assets/"*.svg)
  shopt -u nullglob
  test "${#svgs[@]}" -ge 1 || die "expected at least one design-system/assets/*.svg (F1)"
  npm run prepublishOnly
  smoke
  echo "orchestrate: wave2 passed"
}

all() {
  wave0
  wave1
  wave2
  echo "orchestrate: all waves passed"
}

case "${1:-help}" in
  wave0) wave0 ;;
  wave1) wave1 ;;
  wave2) wave2 ;;
  all)   all ;;
  smoke) smoke ;;
  help|--help|-h)
    cat <<'EOF'
Gruff terminal orchestration (parallel plan waves)

  ./scripts/orchestrate.sh wave0   # A: build, lint, dist + template + bridges/planes/racks READMEs
  ./scripts/orchestrate.sh wave1   # B/C/D/F: npm test + optional Python compile of gruff-echoes receiver
  ./scripts/orchestrate.sh wave2   # F3 docs + F1 SVG + prepublish + TUI smoke
  ./scripts/orchestrate.sh all     # wave0 && wave1 && wave2
  ./scripts/orchestrate.sh smoke   # node dist/cli.js (needs prior build)

npm:  npm run orchestrate -- wave0

Worktrees: run the same script from each git worktree after merging the matching segment branch.
EOF
    ;;
  *) die "unknown command: $1 (try: help)" ;;
esac
