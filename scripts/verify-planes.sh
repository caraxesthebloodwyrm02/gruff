#!/usr/bin/env bash
# verify-planes.sh — verify prototype directory structure
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
        echo "  ✗ $proto_dir is missing"
        MISSING=1
    fi
done

if [ $MISSING -eq 0 ]; then
    echo "All prototype directories verified."
    exit 0
else
    echo "Missing prototype directories."
    exit 1
fi
