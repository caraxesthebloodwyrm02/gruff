#!/usr/bin/env bash
# scripts/bump-actions-node24.sh
# Pins all GitHub Actions in reliability.yml to Node.js 24-compatible versions.
# Deadline: June 2, 2026 — after which Node.js 20 actions are forced to Node.js 24.
#
# Usage: bash scripts/bump-actions-node24.sh [--dry-run] [--check]
#
# Built by Prince (Irfan Kabir)

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)"
WORKFLOW="$REPO_ROOT/.github/workflows/reliability.yml"
DRY_RUN=false
CHECK_ONLY=false

for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
  [[ "$arg" == "--check" ]] && CHECK_ONLY=true
done

echo "=== bump-actions-node24 ==="
echo "Workflow  : $WORKFLOW"
echo "Dry run   : $DRY_RUN"
echo "Check only: $CHECK_ONLY"
echo ""

# ── Version map ──────────────────────────────────────────────────────────────
declare -A BUMPS=(
  ["actions/checkout@v4"]="actions/checkout@v4.2.2"
  ["actions/setup-python@v5"]="actions/setup-python@v5.5.0"
  ["actions/setup-node@v4"]="actions/setup-node@v4.4.0"
  ["docker/setup-buildx-action@v3"]="docker/setup-buildx-action@v3.10.0"
  ["docker/build-push-action@v5"]="docker/build-push-action@v6.16.0"
)

# ── 1. Current state ─────────────────────────────────────────────────────────
echo "--- current uses: pins ---"
grep -n 'uses:' "$WORKFLOW"
echo ""

# ── 2. Check mode ────────────────────────────────────────────────────────────
if [[ "$CHECK_ONLY" == true ]]; then
  FOUND_STALE=false
  for old_pin in "${!BUMPS[@]}"; do
    if grep -qF "$old_pin" "$WORKFLOW"; then
      echo "STALE: $old_pin  →  ${BUMPS[$old_pin]}"
      FOUND_STALE=true
    fi
  done
  [[ "$FOUND_STALE" == false ]] && echo "PASS: all pins already at Node.js 24-compatible versions."
  exit 0
fi

# ── 3. Dry-run mode ──────────────────────────────────────────────────────────
if [[ "$DRY_RUN" == true ]]; then
  echo "[dry-run] Proposed replacements:"
  for old_pin in "${!BUMPS[@]}"; do
    if grep -qF "$old_pin" "$WORKFLOW"; then
      echo "  $old_pin  →  ${BUMPS[$old_pin]}"
    fi
  done
  echo "[dry-run] No files changed."
  exit 0
fi

# ── 4. Apply replacements ────────────────────────────────────────────────────
cp "$WORKFLOW" "$WORKFLOW.bak"

for old_pin in "${!BUMPS[@]}"; do
  new_pin="${BUMPS[$old_pin]}"
  # Only replace exact trailing match (avoids hitting already-pinned versions)
  if grep -qF "$old_pin" "$WORKFLOW"; then
    # Use | as delimiter to avoid issues with /
    sed -i "s|${old_pin}$|${new_pin}|g" "$WORKFLOW"
    echo "Bumped: $old_pin  →  $new_pin"
  else
    echo "Skip  : $old_pin (not found — may already be pinned)"
  fi
done

echo ""

# ── 5. Validate YAML ─────────────────────────────────────────────────────────
echo "--- YAML validation ---"
python3 -c "import yaml, sys; yaml.safe_load(sys.stdin)" < "$WORKFLOW" \
  && echo "PASS: valid YAML" \
  || { echo "FAIL: invalid YAML — restoring backup"; cp "$WORKFLOW.bak" "$WORKFLOW"; exit 1; }

rm -f "$WORKFLOW.bak"
echo ""

# ── 6. Diff ──────────────────────────────────────────────────────────────────
echo "--- diff ---"
git -C "$REPO_ROOT" diff "$WORKFLOW"
echo ""

# ── 7. Stage ─────────────────────────────────────────────────────────────────
git -C "$REPO_ROOT" add "$WORKFLOW"
echo "Staged: $WORKFLOW"
echo ""

echo "=== Ready to commit ==="
echo "Run:"
cat <<'EOF'
  git -C /home/irfankabir/gruff commit -m "chore: pin actions to Node.js 24-compatible versions (deadline June 2 2026)

- actions/checkout@v4 → @v4.2.2 (all 3 jobs)
- actions/setup-python@v5 → @v5.5.0
- actions/setup-node@v4 → @v4.4.0
- docker/setup-buildx-action@v3 → @v3.10.0
- docker/build-push-action@v5 → @v6.16.0"
EOF
