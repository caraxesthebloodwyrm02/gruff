# Main Batch Manifest — Gate 2/3 Finalization

Generated during Phase A sync/reconcile across:
- `/home/irfankabir/workspace`
- `/home/irfankabir/workspace/CascadeProjects`
- `/home/irfankabir/workspace/CascadeProjects/Projects/GRID-main`

## Included in batch (tracked)

### Workspace repo
- `review-package/10-gate2-3-recovery-evidence.md`
- `scripts/verify-gate23-controls.sh`
- `review-package/11-main-batch-manifest.md` (this file)
- `.gitignore` (tightening for workspace variants)

### CascadeProjects repo
- `Hogwarts/staircase/README.md`
- `Hogwarts/staircase/floors.yaml`
- `Hogwarts/staircase/staircases.yaml`
- `Tools/MCPServers/nexus-server/package.json`
- `Tools/MCPServers/nexus-server/tsconfig.json`
- `Tools/MCPServers/nexus-server/src/index.ts`
- `Tools/MCPServers/nexus-server/src/engine/core.ts`
- `Tools/MCPServers/school-server/package.json`
- `Tools/MCPServers/school-server/tsconfig.json`
- `Tools/MCPServers/school-server/src/index.ts`
- `Tools/MCPServers/school-server/src/engine/learning.ts`
- `.gitignore` (tightening for local dirty-state report artifact)

### GRID-main repo
- `docs/archive/sessions/CODEMAP_SYNTHESIS_2026-04-20.md`
- `.gitignore` (tightening for local privacy scan artifacts)

## Reviewed and intentionally ignored

### Workspace repo
- `campus.code-workspace`  
  Rationale: machine-local workspace view variant; canonical tracked file is `workspace.code-workspace`.

### CascadeProjects repo
- `.dirty-state-report.md`  
  Rationale: local, point-in-time triage report generated during consolidation.

### GRID-main repo
- `.privacy.json`
- `privacy_report.md`  
  Rationale: local privacy scan config/output containing host-specific paths and generated risk scan data.

## Gate-2/3 relevance notes
- New MCP servers (`nexus-server`, `school-server`) are now explicitly part of this delivery batch and will be build/test-validated in the verification phase.
- Staircase artifacts are declarative Hogwarts routing primitives; included as source content (not generated artifacts).

## See also (narrow ~72h review bundle)

- **`12-narrow-72h-structured-review.md`** — GRID **#110** / **#118**, hogsmade submodule pin `c49c72f`, `RELEASE_READINESS`, explicit pytest scope, local WIP disclosure, reviewer checklist.
