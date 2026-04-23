# Topic × Tool Coverage Matrix

This matrix proves every topic in `AGENTS.md` is reachable from every tool in ≤ 1 hop.

| Topic | AGENTS.md | CLAUDE.md | .cursorrules | Cursor rules | Cursor skills | Windsurf | Zed | Copilot | Codex | OpenCode | Antigravity | Devin |
|-------|-----------|-----------|--------------|--------------|---------------|----------|-----|---------|-------|----------|-------------|-------|
| Agent Registry | canonical | pointer | pointer | - | - | - | - | pointer | - | - | - | - |
| Primary agent model | canonical | pointer | pointer | - | - | - | - | pointer | - | - | - | - |
| Project Structure | canonical | pointer | pointer | - | - | - | - | pointer | - | - | - | - |
| Build/Test Commands | canonical | pointer | pointer | - | - | - | - | pointer | - | - | - | - |
| Coding Style | canonical | pointer | pointer | - | - | - | - | pointer | - | - | - | - |
| Testing | canonical | pointer | pointer | - | - | - | - | pointer | - | - | - | - |
| Commits & PRs | canonical | pointer | pointer | - | - | - | - | pointer | - | - | - | - |
| Security & Config | canonical | pointer | pointer | - | - | - | - | pointer | - | - | - | - |
| Git hygiene | canonical | pointer | pointer | - | - | - | - | pointer | - | - | - | - |
| TUV-001 (Dev Contract) | canonical | pointer | pointer | - | - | - | - | pointer | - | - | - | - |
| Cursor-specific filters | delta | - | - | delta | delta | - | - | - | - | - | - | - |
| Cursor hooks | delta | - | - | delta | - | - | - | - | - | - | - | - |

**Legend**:
- `canonical` - This file IS the authoritative source for this topic
- `pointer` - This file points TO the canonical source (≤ 1 hop)
- `delta` - This file adds tool-specific behavior (not duplicating)
- `-` - Tool doesn't need this topic (or not applicable)

## Coverage Verification

### Each topic must have:
- Exactly one `canonical` ✓
- Zero to N `pointer` or `delta` ✓
- Dashes (`-`) where tool doesn't need the topic ✓

### Tools requiring no changes (already aligned):
- Claude Code - Uses `CLAUDE.md` pointing to `AGENTS.md`
- Copilot - Uses `.github/copilot-instructions.md` pointing to `AGENTS.md`
- Windsurf - No rules needed; falls back to `AGENTS.md`
- Zed - No rules needed; falls back to `AGENTS.md`
- Codex - MCP config only; falls back to `AGENTS.md`
- OpenCode - No rules; falls back to `AGENTS.md`
- Antigravity - No rules; falls back to `AGENTS.md`
- Devin - No rules; falls back to `AGENTS.md`

### Tools with changes:
- **Cursor** - Added `.cursorrules` as thin pointer; kept existing deltas
- **Personal agents** - Created `prince-runtime-intel.md` and `caraxes.md` (requires approval for any deletion)

## Conclusion

**All tools have a path to `AGENTS.md` in ≤ 1 hop.**
**No external filesystem references in actual behavior files.**
**No duplicate topic coverage.**
