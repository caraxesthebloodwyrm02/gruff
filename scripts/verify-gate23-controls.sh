#!/usr/bin/env bash
# verify-gate23-controls.sh
# Minimum control checks for Gate 2/3 recovery (R1-R5).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CASCADE_DIR="$ROOT_DIR/CascadeProjects"

SHARED_TYPES_DIR="$CASCADE_DIR/Components/shared-types"
ORI_DIR="$CASCADE_DIR/Tools/MCPServers/ori-server"
SERVERS_DIR="$CASCADE_DIR/Tools/MCPServers"
AFLOAT_DIR="$SERVERS_DIR/afloat-server"
SCHOOL_DIR="$SERVERS_DIR/school-server"

FAILURES=0
WARNINGS=0

ok() {
  printf 'ok    %s\n' "$1"
}

fail() {
  printf 'FAIL  %s\n' "$1"
  FAILURES=$((FAILURES + 1))
}

warn() {
  printf 'WARN  %s\n' "$1"
  WARNINGS=$((WARNINGS + 1))
}

section() {
  printf '\n# %s\n' "$1"
}

require_file() {
  local file="$1"
  local desc="$2"
  if [ -f "$file" ]; then
    ok "$desc ($file)"
  else
    fail "$desc missing ($file)"
  fi
}

check_file_optional() {
  local file="$1"
  local desc="$2"
  if [ -f "$file" ]; then
    ok "$desc ($file)"
  else
    warn "$desc missing (deferred): $file"
  fi
}

section "R1 — Type drift across MCP boundary"

# Control: shared-types build artifacts must exist for all declared exports.
if node - "$SHARED_TYPES_DIR/package.json" "$SHARED_TYPES_DIR" <<'NODE'
const fs = require("fs");
const path = require("path");
const pkgPath = process.argv[2];
const baseDir = process.argv[3];
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const missing = [];
for (const [key, value] of Object.entries(pkg.exports || {})) {
  if (key === "." && value && value.default) {
    const out = path.join(baseDir, value.default.replace(/^\.\//, ""));
    if (!fs.existsSync(out)) missing.push(`${key}:${out}`);
  } else if (value && value.default) {
    const out = path.join(baseDir, value.default.replace(/^\.\//, ""));
    if (!fs.existsSync(out)) missing.push(`${key}:${out}`);
  }
}
if (missing.length > 0) {
  console.error("missing exports:", missing.join(", "));
  process.exit(1);
}
NODE
then
  ok "shared-types export artifacts present"
else
  fail "shared-types export artifacts missing"
fi

# Control: high/medium-risk servers must pin local shared-types path.
if node - "$SERVERS_DIR" <<'NODE'
const fs = require("fs");
const path = require("path");
const servers = ["grid-server", "afloat-server", "echoes-server", "ori-server"];
let bad = [];
for (const s of servers) {
  const pkgPath = path.join(process.argv[2], s, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const dep = (pkg.dependencies || {})["@cascade/shared-types"];
  if (dep !== "file:../../../Components/shared-types") {
    bad.push(`${s}:${dep ?? "<missing>"}`);
  }
}
if (bad.length > 0) {
  console.error("dependency mismatch:", bad.join(", "));
  process.exit(1);
}
NODE
then
  ok "server shared-types dependency pins are consistent"
else
  fail "server shared-types dependency pins are inconsistent"
fi

section "R2 — Silent JSON shape changes"

# Control: audit event schema fields are present in canonical shared-types schema.
if node - "$SHARED_TYPES_DIR/src/audit.ts" <<'NODE'
const fs = require("fs");
const text = fs.readFileSync(process.argv[2], "utf8");
const required = ["timestamp", "source", "tool", "status", "durationMs", "metadata"];
for (const key of required) {
  if (!text.includes(`${key}:`)) {
    console.error(`missing audit schema key: ${key}`);
    process.exit(1);
  }
}
NODE
then
  ok "audit schema sentinel keys present"
else
  fail "audit schema sentinel keys missing"
fi

# Control: anticipation signal shape fields are present in ori-server type.
if node - "$ORI_DIR/src/anticipation.ts" <<'NODE'
const fs = require("fs");
const text = fs.readFileSync(process.argv[2], "utf8");
const required = [
  "id:",
  "category:",
  "confidence:",
  "horizon:",
  "target:",
  "transition:",
  "evidence:",
  "action:",
  "generatedAt:",
  "resolved:",
];
for (const token of required) {
  if (!text.includes(token)) {
    console.error(`missing anticipation token: ${token}`);
    process.exit(1);
  }
}
NODE
then
  ok "anticipation signal shape sentinel keys present"
else
  fail "anticipation signal shape sentinel keys missing"
fi

# Control: afloat policy snapshot tool is present and keeps required contract keys.
if node - "$AFLOAT_DIR/src/server.ts" <<'NODE'
const fs = require("fs");
const text = fs.readFileSync(process.argv[2], "utf8");
const required = [
  'server.registerTool(',
  '"fetch_policy"',
  "policyId:",
  "allowedRoots:",
  "previewTokenTtlMs:",
  "enforcedPolicyIds:",
];
for (const token of required) {
  if (!text.includes(token)) {
    console.error(`missing afloat policy token: ${token}`);
    process.exit(1);
  }
}
NODE
then
  ok "afloat policy snapshot contract sentinel keys present"
else
  fail "afloat policy snapshot contract sentinel keys missing"
fi

section "R3 — GRID submodule policy confusion"

# Control: GRID-main submodule must be declared and resolvable from CascadeProjects.
if git -C "$CASCADE_DIR" submodule status "Projects/GRID-main" >/dev/null 2>&1; then
  ok "GRID-main submodule is declared in CascadeProjects"
else
  fail "GRID-main submodule declaration missing or unreadable"
fi

require_file "$CASCADE_DIR/.gitmodules" "CascadeProjects submodule policy file"

section "R4 — False green CI"

# Control: enforce that smoke-capable servers actually have smoke tests.
require_file "$SERVERS_DIR/afloat-server/tests/smoke.test.ts" "afloat smoke test"
require_file "$SERVERS_DIR/grid-server/tests/smoke.test.ts" "grid smoke test"
require_file "$SERVERS_DIR/echoes-server/tests/smoke.test.ts" "echoes smoke test"
require_file "$SERVERS_DIR/ori-server/tests/smoke.test.ts" "ori smoke test"
check_file_optional "$SERVERS_DIR/school-server/tests/smoke.test.ts" "school smoke test"

section "School compartment checkpoint presence"

check_file_optional "$SCHOOL_DIR/package.json" "school-server package manifest"
check_file_optional "$SCHOOL_DIR/src/index.ts" "school-server MCP entrypoint"

section "R5 — Audit narrative vs evidence drift"

# Control: evidence documents must exist before gate promotion.
require_file "$ROOT_DIR/review-package/08-findings.md" "ultrareview findings record"
require_file "$ROOT_DIR/review-package/07-preflight.log" "preflight evidence log"

printf '\nsummary: failures=%s warnings=%s\n' "$FAILURES" "$WARNINGS"

[ "$FAILURES" -eq 0 ] && exit 0 || exit 1
