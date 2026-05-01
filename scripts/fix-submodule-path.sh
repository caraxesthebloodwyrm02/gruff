#!/usr/bin/env bash
# scripts/fix-submodule-path.sh
# Repairs the .gitmodules path mismatch in gruff.
# The git index tracks the submodule at workspace/python-prototype but
# .gitmodules registers it as path = python-prototype (root-level).
#
# Usage: bash scripts/fix-submodule-path.sh [--dry-run]
#
# Built by Prince (Irfan Kabir)

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
GITMODULES="$REPO_ROOT/.gitmodules"
DRY_RUN=false

for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
done

echo "=== fix-submodule-path ==="
echo "Repo root : $REPO_ROOT"
echo "Dry run   : $DRY_RUN"
echo ""

# ── 1. Diagnose ──────────────────────────────────────────────────────────────
echo "--- .gitmodules (before) ---"
cat "$GITMODULES"
echo ""

echo "--- git index gitlinks ---"
git -C "$REPO_ROOT" ls-files --stage | grep ^160000 || echo "(no gitlinks in index)"
echo ""

echo "--- submodule status (before) ---"
git -C "$REPO_ROOT" submodule status || true
echo ""

# ── 2. Detect mismatch ───────────────────────────────────────────────────────
CURRENT_PATH=$(grep -E '^\s*path\s*=' "$GITMODULES" | head -1 | sed 's/.*=\s*//' | xargs)
TRACKED_PATH=$(git -C "$REPO_ROOT" ls-files --stage | grep ^160000 | awk '{print $4}' | head -1)

if [[ -z "$TRACKED_PATH" ]]; then
  echo "ERROR: no gitlink found in the index — nothing to fix." >&2
  exit 1
fi

if [[ "$CURRENT_PATH" == "$TRACKED_PATH" ]]; then
  echo "PASS: .gitmodules path ('$CURRENT_PATH') already matches tracked path ('$TRACKED_PATH')."
  echo "No changes needed."
  exit 0
fi

echo "MISMATCH DETECTED"
echo "  .gitmodules path : $CURRENT_PATH"
echo "  index gitlink    : $TRACKED_PATH"
echo ""

# ── 3. Apply fix ─────────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == true ]]; then
  echo "[dry-run] Would replace path = $CURRENT_PATH  →  path = $TRACKED_PATH in .gitmodules"
  echo "[dry-run] Would run: git submodule sync"
  echo "[dry-run] No files changed."
  exit 0
fi

sed -i "s|path = ${CURRENT_PATH}|path = ${TRACKED_PATH}|" "$GITMODULES"
echo "Updated .gitmodules: path = $TRACKED_PATH"

git -C "$REPO_ROOT" submodule sync
echo "Ran: git submodule sync"
echo ""

# ── 4. Verify ────────────────────────────────────────────────────────────────
echo "--- .gitmodules (after) ---"
cat "$GITMODULES"
echo ""

echo "--- submodule status (after) ---"
git -C "$REPO_ROOT" submodule status || true
echo ""

echo "--- staged changes ---"
git -C "$REPO_ROOT" add "$GITMODULES"
git -C "$REPO_ROOT" diff --cached --stat
echo ""

echo "=== Ready to commit ==="
echo "Run:"
echo "  git -C $REPO_ROOT commit -m \"fix: align .gitmodules path with tracked gitlink (workspace/python-prototype)\""
