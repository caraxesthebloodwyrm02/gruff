# Commit-Sync CI/CD Green Strategy (review/ultrareview-2026-04-20)

## Branch and Diff Snapshot

- Current branch: `review/ultrareview-2026-04-20`
- Divergence from `main`: `behind=0`, `ahead=5`
- 36-hour commit window includes:
  - workspace initialization and renovation
  - pipeline-monitoring package introduction
  - design docs and ultrareview artifacts
- `main...HEAD` currently contains 20 changed files (mostly documentation/review artifacts plus `.pipeline-monitoring/*` code).

## Current Merge Risks (must be neutralized first)

1. Working tree is not clean:
   - Modified: `.pipeline-monitoring/exploration-routine.ts`
   - Modified: `review-package/08-findings.md`
   - Untracked: `package-lock.json` (root-level, accidental empty lockfile)
   - Untracked: `2026-04-20-203612-local-command-caveatcaveat-the-messages-below.txt`
2. No repository-level GitHub workflow found at `.github/workflows/`, so merge safety is currently procedural/manual.
3. Review package includes large binary/tar artifacts (`review-package/*.tar`) that should remain explicit and intentional in merge scope.

## Commit-Sync Strategy

1. Normalize local state before any sync:
   - Keep only intended changes for this branch.
   - Drop accidental root `package-lock.json` unless this repo is becoming an npm root package (currently it is not).
   - Either commit or move debug-only edits out of merge scope.
2. Rebase/sync policy:
   - `git fetch origin`
   - Re-check divergence against `origin/main`
   - If `origin/main` advanced, rebase branch and resolve conflicts immediately while context is fresh.
3. Commit slicing for clarity:
   - Slice by intent:
     - infrastructure/workspace metadata
     - `.pipeline-monitoring` functional code
     - review artifacts/docs
   - This minimizes conflict blast radius and simplifies rollback/cherry-pick if needed.
4. Freeze rule before merge:
   - No new feature edits after CI turns green.
   - Only conflict resolution or CI-fix commits are allowed.

## Cache Strategy (CI determinism)

Because there are mixed ecosystems (`npm`, Python, uv/pytest in referenced repos), use lockfile-keyed caches only:

1. Node cache key:
   - Key by OS + Node version + hash of `**/package-lock.json`
   - Paths: npm cache directory (not `node_modules` directly unless single-package and stable)
2. Python cache key:
   - Key by OS + Python version + lock/constraints hash
   - Paths: pip/uv cache directories
3. Invalidation rules:
   - Any lockfile change invalidates cache
   - Branch-only cache namespace to avoid cross-branch poisoning
4. Hard rule:
   - Never introduce generated lockfiles at repo root unless root `package.json` exists and is intentional.

## CI/CD Green Job Topology

Define required checks for clean merge:

1. **preflight-branch-state**
   - Assert clean tree, no unexpected untracked files
   - Fail if root `package-lock.json` exists without root `package.json`
2. **workspace-structure-lint**
   - Validate `.gitignore`, workspace metadata consistency
3. **pipeline-monitoring-typecheck**
   - `cd .pipeline-monitoring`
   - `npm ci`
   - `npx tsc --noEmit`
4. **pipeline-monitoring-smoke**
   - Run deterministic smoke commands for `exploration-routine.ts` (happy path + invalid input path)
5. **artifact-integrity-check**
   - Verify review-package files expected by scope (`00-08` and new strategy doc)
   - Optional: checksum tar artifacts to detect accidental mutation
6. **merge-readiness-gate**
   - Requires all prior jobs green
   - Enforces no pending TODO blockers in findings if policy requires

## Merge Execution Plan (main-safe)

1. Clean local state (remove accidental/unintended files).
2. Sync branch with latest `origin/main`.
3. Run full required pipeline; block merge on any red.
4. Perform one final `main...HEAD` scope check for accidental files.
5. Merge using non-fast-forward or squash based on release audit preference.

## Review Notes and Reasoning

- The branch is structurally close to merge-ready because it is not behind `main`.
- The top blocker is not code correctness but merge hygiene (dirty tree and accidental artifacts).
- CI definition is currently the missing control plane; without required checks, merge quality relies on manual discipline.
- Lockfile-keyed cache discipline is critical here because this branch mixes generated assets and multiple toolchains.
