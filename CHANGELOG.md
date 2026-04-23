# Changelog

All notable changes to [`@irfankabir002/gruff`](https://www.npmjs.com/package/@irfankabir002/gruff) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.3] - 2026-04-23

### Added
- **Trust engine (B):** `src/trust/scorer.ts` — `tier` and `tier_changed_at` loaded together
  from `actor_profile` before upsert; `tierChanged` derived from `profileBefore` vs computed
  tier; `nextTierChangedAt` preserved when tier is unchanged; promoted-sticky branch reuses
  `profileBefore.tier_changed_at` with 24 h expiry window.
- **Trust engine (B):** `src/trust/ingester.ts` — `metadata.server_id` and `metadata.client`
  added to `deriveActor` fallback chain; warning emitted to stderr when actor resolves to
  `'unknown'`, listing available metadata keys.
- **Trust engine (B):** `src/trust/db.ts` — `mkdirSync(dirname(dbPath), { recursive: true })`
  guards custom `GRUFF_TRUST_SQLITE` paths; `__resetTrustDbForTests` exported for test harness;
  `getReadonlyDb` falls back to `getDb()` when the file does not yet exist.
- **Tests (B):** `src/trust/scorer.test.ts` — 51 tests across 9 suites: `computeScore` edge
  cases (zero events, clamping), all 7 `scoreToTier` boundaries, `recomputeActor` for
  `mcp:system`, profile creation, `tier_changed_at` tracking (preserve + update), banned
  override, promoted-sticky (within/expired/no-prior/non-school), `notes_json` integrity,
  and aggregate counter accuracy.
- **Tests (B):** `src/trust/db.test.ts` — 35 tests across 8 suites: `ingestAuditEvent`
  roundtrip and null/set duration, `lookupTier` default and stored tiers, `getActorProfile`
  undefined and full shape, `listActors` sort and limit, `recordRoutingDecision` row shape and
  accumulation, `queryRaw` SELECT/COUNT/empty and rejection of INSERT/DROP/UPDATE,
  `getReadonlyDb` creation and read-after-write, `__resetTrustDbForTests` fresh-path isolation.
- **Tests (B):** `src/commands/proportion.test.ts` — 35 tests across 7 suites: valid documents
  (boundary values, multi-key metrics), type errors (string/boolean/array/null), `schemaVersion`
  const constraint, range violations (theta exclusiveMaximum, audioDrive/weight/cog out-of-range,
  negative stepIndex, negative gain), all 9 top-level + 12 nested missing required fields,
  `additionalProperties` enforcement on root/cog/weights/sequence, and return-value shape.
- **TUI panels (C):** `src/menu/panels/mcp.tsx` — `CASCADE_WORKSPACE_ROOT` env var fallback
  for `mcp_config.json` path resolution.
- **TUI panels (C):** `src/menu/panels/horizon.tsx` — `GATE_DIR` env fallback; candidate arrays
  for `ORI_ANTICIPATION_PATH` and `ELIGIBILITY_CYCLES_PATH` with graceful first-existing-file
  resolution; all panels degrade to dimmed placeholder text when files are absent.
- **Proportion (B/D):** `src/commands/proportion.ts` — Ajv draft 2020-12 (`ajv/dist/2020.js`);
  `validateProportionPayload` exported for test and library use; `GRUFF_ECHOES_URL` env var
  overrides the default `http://127.0.0.1:<PORT>/gruff/proportion` endpoint.
- **Bridge (D2/D3):** `bridges/gruff-echoes/receiver.py` — `ECHOES_URL` upstream forwarding
  with `ECHOES_TOKEN` Bearer auth; `ReusableHTTPServer` (`allow_reuse_address = True`); GET
  `/gruff/proportion` returns 405 instead of 501; graceful `BrokenPipeError` handling on write.
- **Design (F1):** `design-system/assets/gruff-mark.svg` now tracked in git.
- **Docs (F2):** `hogsmade-design/README.md` — design-language overview for the Hogsmade
  governance board: token hierarchy, SVG asset table, usage examples, and cross-reference to
  `CascadeProjects/Hogwarts/board/`. Directory is gitignored (local overlay); README is the
  canonical reference copy.
- **Docs (F3):** `docs/index.md` — architecture snapshot: entrypoints, trust data flow
  (Mermaid diagram), maintainer notes for non-interactive TUI exit and `better-sqlite3` rebuild.
- **Planes (E3):** `planes/surfaces/tui-panels.md` — canonical four-quadrant surface artifact
  mapping NW/NE/SW/SE labels, component paths, data sources, and env vars to `Menu.tsx`.
- **Racks (E3):** `racks/learning/NOTES.md` — operator-local spec (gitignored by design).
- **Scripts:** `scripts/orchestrate.sh` — wave gate runner (`wave0` / `wave1` / `wave2` /
  `all` / `smoke`); `wave2` checks `docs/index.md`, SVG assets, `prepublishOnly`, and TUI smoke.
- **Repo hygiene:** `.github/` issue/PR templates, `FUNDING.yml`, `.editorconfig`, `.nvmrc`,
  `SECURITY.md`, `.dockerignore`; removed `review-package/` scratch tree and stale root docs
  (`CENTRAL_PLAZA.md`, `CIRCUIT_BREAKER_PATCHING_SUMMARY.md`, `SPEC.md`, `WORKSPACE_GATES.md`,
  and others).

### Fixed
- **CLI:** `src/cli.tsx` `--version` path was `../../package.json`, which resolves one directory
  above the workspace root (`/home/.../gruff/package.json`); corrected to `../package.json`
  so `gruff --version` correctly reads `workspace/package.json`.
- **Native binding (C4):** `better-sqlite3` native add-on recompiled against Node 24
  (`npm rebuild better-sqlite3`); 121 unit tests pass; `orchestrate wave2` gate passes.

## [0.1.2] - 2026-04-21

### Added
- **CI:** npm dependency caching across all `setup-node` steps (30–60% install speedup).
- **CI:** Concurrency control to cancel redundant workflow runs on new pushes.
- **CI:** `id-token: write` permission to enable npm trusted publishing (OIDC).
- **CI:** `--provenance` flag on `npm publish` for OpenSSF-compliant supply-chain attestation.
- **CI:** `--ignore-scripts` flag on `npm publish` to block lifecycle scripts during publish.
- **CI:** Build artifact upload/download between `build` and `publish` jobs for bit-for-bit reproducibility.
- **CI:** Commented `test` job template staged for future Vitest integration.
- **Docs:** `CHANGELOG.md` created (this file).

### Fixed
- **Build:** `design-system/colors_and_type.css` and `design-system/assets/*.svg` are now tracked in git; previously gitignored but required by `scripts/extract-tokens.mjs` and `package.json` `"files"`, causing CI `ENOENT` failures.
- **CI:** `softprops/action-gh-release` pinned from non-existent `v3` to `v2`.

### Changed
- `.gitignore`: `design-system/` pattern replaced with `design-system/**` plus explicit negations for publish-required files (`README.md`, `colors_and_type.css`, `assets/*.svg`). `tokens.json` remains ignored (generated by build).

### Security
- Established foundation for trusted publishing (OIDC); manual npmjs.com configuration required before `NODE_AUTH_TOKEN` can be removed from the publish job.

## [0.1.1] - 2026-04 (npm `next`)

### Added
- `feat(diagnostics)`: multi-stage path diagnostic tool.
- `ci`: release workflow expanded with quality gates (lint → build → security → publish).
- `ci`: `--ci` mode added to diagnostic scan for automated environments.
- `docs`: diagnostic tool section added to README; `DIAGNOSTIC_PATHS.md` expanded.

### Fixed
- Duplicate `scanBugs` declaration.

### Notes
- Published to npm under `next` tag only; no matching git tag was created at release time.

## [0.1.0-rc.1] - 2026-04 (npm `latest`)

### Added
- Initial release candidate: workspace cockpit + trust-routing overlay.
- GRID design system tokens, voice guide.
- 4-quadrant TUI cockpit (MCP / Inference / Agency / Horizon).
- Actor-scoring layer over the MCP fleet.
- `gruff` and `gruff-ingester` CLI binaries.

[Unreleased]: https://github.com/caraxesthebloodwyrm02/gruff/compare/v0.1.3...HEAD
[0.1.3]: https://github.com/caraxesthebloodwyrm02/gruff/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/caraxesthebloodwyrm02/gruff/compare/v0.1.0-rc.1...v0.1.2
[0.1.1]: https://www.npmjs.com/package/@irfankabir002/gruff/v/0.1.1
[0.1.0-rc.1]: https://github.com/caraxesthebloodwyrm02/gruff/releases/tag/v0.1.0-rc.1
