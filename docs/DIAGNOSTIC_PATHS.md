# Diagnostic Paths — Workspace Health Checker

A multi-stage diagnostic tool for detecting path staleness, code patterns, and structural issues in the gruff workspace.

## Usage

```bash
# Stage 1: Path diagnostics only
node scripts/diagnostic-paths.mjs

# Stage 1 + 2: Paths + bug scan
node scripts/diagnostic-paths.mjs --bugs

# All stages: Paths + bugs + format checks
node scripts/diagnostic-paths.mjs --bugs --format
```

## Stages

| Stage | Range | Function |
|-------|-------|----------|
| 1 | 0-30% | Path diagnostics, symlink validation, canonical alignment |
| 2 | 30-65% | Bug pattern scan (20 regex rules) |
| 3 | 65-80% | Format checks (imports, functions, attributes) |
| 4 | 80-100% | Report generation |

## Features

### Path Diagnostics
- Detects broken, stale, or diverged symlinks
- Validates paths point to canonical: `/mnt/arch_data/home/caraxes`
- Reports missing directories

### Bug Patterns (20 rules)
- **Critical**: hardcoded secrets, eval(), innerHTML (XSS)
- **Warning**: TODO/FIXME, debug flags, empty catch, any type, npm global install, sudo
- **Info**: console.log, process.env, hardcoded ports, async patterns

### Format Checks
- **Import order**: Validates relative imports don't follow external
- **Function metrics**: Column count (parameters), async complexity
- **Attributes**: Property count, type annotations
- **Properties**: Deep chain detection

## Configuration

Edit constants at top of `diagnostic-paths.mjs`:
- `CANONICAL_BASE`: Default target for symlinks
- `DIRECTORIES`: Top-level workspace dirs
- `SCRIPTS_DIRS`: Source directories to scan
- `BUG_PATTERNS`: Regex rules for bug detection

## Example Output

```
🔍 Path Diagnostic Report
Workspace: /home/irfankabir/gruff/workspace
Canonical: /mnt/arch_data/home/caraxes
---
✅ CascadeProjects → canonical
✅ canopy → canonical
✅ roots → canonical

---
Summary: 5/5 paths healthy

🐛 Bug Pattern Scan
ℹ️ INFO (25): console.log in dispatch.js

📝 Format Checks
✅ All format checks passed
```

## Integration

Add to crontab for scheduled runs:
```bash
0 9 * * 1 cd /home/irfankabir/gruff/workspace && node scripts/diagnostic-paths.mjs --bugs --format >> ~/diagnostic.log 2>&1
```

## Files

- `scripts/diagnostic-paths.mjs`: Main diagnostic tool
- `docs/DIAGNOSTIC_PATHS.md`: This documentation