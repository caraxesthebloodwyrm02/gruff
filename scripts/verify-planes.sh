#!/usr/bin/env bash
# verify-planes.sh — on-demand drift detector.
#
# Asserts every top-level dir under {Tools/MCPServers, Applications,
# Projects, Components, Hogwarts} maps to either a plane symlink under
# planes/, or the explicit whitelist below.
#
# The source tree may live under CascadeProjects/ (the canonical monorepo
# layout) or directly at the checkout root (the plane-grouped workspace
# view). This script auto-detects which is present so it does not
# degenerate into an all-skips no-op in either layout.

set -euo pipefail
cd "$(dirname "$0")/.."

# staircase: declarative Hogwarts routing (YAML), not a plane symlink yet.
# hogwarts-server: MCP scaffold co-located under Hogwarts fleet; map when planes/ entry exists.
WHITELIST_RE='^(integration-review|tests|config|experiments|scripts|research|projects|staircase|hogwarts-server)$'

ok=0
skip=0
drift=0

if [ -d "CascadeProjects" ]; then
  SRC_PREFIX="CascadeProjects/"
else
  SRC_PREFIX=""
fi

check_dir() {
  local root="$1"
  local base="${SRC_PREFIX}${root}"
  [ -d "$base" ] || { echo "SKIP root missing: $root"; return; }
  for entry in "$base"/*/; do
    [ -d "$entry" ] || continue
    local name
    name="$(basename "$entry")"
    # Match plane symlinks by the logical suffix "/<root>/<name>" so both
    # CascadeProjects/Tools/MCPServers/foo and Tools/MCPServers/foo count.
    if [ -d "planes" ] && find planes -type l -lname "*/${root}/${name}" 2>/dev/null | grep -q .; then
      printf 'ok    %-40s  %s\n' "$root/$name" "(plane mapping found)"
      ok=$((ok+1))
    elif [[ "$name" =~ $WHITELIST_RE ]]; then
      printf 'skip  %-40s  %s\n' "$root/$name" "(whitelisted)"
      skip=$((skip+1))
    else
      printf 'DRIFT %-40s  %s\n' "$root/$name" "(no plane mapping)"
      drift=$((drift+1))
    fi
  done
}

echo "# verify-planes.sh — drift report"
echo

check_dir "Tools/MCPServers"
check_dir "Applications"
check_dir "Projects"
check_dir "Components"
check_dir "Hogwarts"

echo
echo "summary: ok=$ok, skip=$skip, drift=$drift"
[ "$drift" -eq 0 ] && exit 0 || exit 1
