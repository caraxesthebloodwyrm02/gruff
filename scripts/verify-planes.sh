#!/usr/bin/env bash
# verify-planes.sh — verify prototype directory structure
# Missing dirs emit a warning but do NOT block the push (exit 0).
# Prototype dirs are optional planes; their absence is advisory, not drift.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Checking prototype directories..."

# Define expected prototype directories
PROTOTYPES=("prototype" "rust-prototype" "python-prototype")

MISSING=0
for proto_dir in "${PROTOTYPES[@]}"; do
    if [ -d "$REPO_ROOT/$proto_dir" ]; then
        echo "  ✓ $proto_dir exists"
    else
        echo "  ⚠ $proto_dir is missing (advisory — push not blocked)"
        MISSING=1
    fi
done

if [ $MISSING -eq 0 ]; then
    echo "All prototype directories verified."
else
    echo "Some prototype directories are absent. Review if intentional."
fi

exit 0
