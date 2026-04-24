from __future__ import annotations

import csv
import json
import os
import tempfile
from dataclasses import dataclass
from hashlib import sha256
from io import StringIO
from pathlib import Path
from typing import Any
from uuid import uuid4

from notebook_engine.blocks import (
    ALLOWED_TONES,
    Block,
    BlockCreate,
    BlockValidationError,
    normalize_block_create,
    utc_now,
)
from notebook_engine.bridge import GruffCompassPayload, build_gruff_payload, persist_payload
from notebook_engine.craft import CraftRenderer
from notebook_engine.grid import BlockBounds, GridConfig, UniversalGrid
from notebook_engine.manifest import (
    ArtifactRef,
    CompassMetrics,
    NotebookEvent,
    NotebookManifest,
    NotebookRevision,
    create_default_manifest,
)


@dataclass(frozen=True)
class HealthStatus:
    craft_ready: bool
    craft_detail: str
    manifest_path: str
    schema_path: str
    bridge_schema_path: str
    current_revision_id: str | None


class NotebookService:
    def __init__(
        self,
        *,
        manifest_path: Path,
        grid_config: GridConfig | None = None,
        craft_renderer: CraftRenderer,
        schema_path: Path,
        bridge_schema_path: Path,
        manifest_schema_path: Path,
        craft_required: bool = True,
        max_inline_history: int = 500,
        audit_enabled: bool | None = None,
        audit_path: Path | None = None,
    ) -> None:
        self.manifest_path = manifest_path
        self.grid_config = grid_config or GridConfig()
        self.craft_renderer = craft_renderer
        self.schema_path = schema_path
        self.bridge_schema_path = bridge_schema_path
        self.manifest_schema_path = manifest_schema_path
        self.craft_required = craft_required
        self._max_inline_history = max(2, max_inline_history)
        self._history_archive_path = manifest_path.with_name(manifest_path.name + '.history.jsonl')
        if audit_enabled is None:
            disabled = os.environ.get('LO7_DISABLE_AUDIT_EMIT', '').strip().lower()
            audit_enabled = disabled not in {'1', 'true', 'yes', 'on'}
        self._audit_enabled = audit_enabled
        self._audit_path = audit_path or Path(
            os.environ.get('LO7_AUDIT_PATH', str(Path.home() / '.echoes' / 'audit.ndjson'))
        )
        self._manifest = self._load_manifest()

    def emit_audit_event(
        self,
        *,
        tool: str,
        status: str = 'success',
        metadata: dict[str, Any] | None = None,
        source: str = 'notebook-engine',
    ) -> None:
        if not self._audit_enabled:
            return
        event = {
            'timestamp': utc_now(),
            'source': source,
            'tool': tool,
            'status': status,
            'metadata': {
                'entity_id': 'notebook-engine',
                'server_id': 'notebook-engine',
                'actor': 'notebook-engine',
                **(metadata or {}),
            },
        }
        try:
            self._audit_path.parent.mkdir(parents=True, exist_ok=True)
            with self._audit_path.open('a', encoding='utf-8') as handle:
                handle.write(json.dumps(event, separators=(',', ':')) + '\n')
        except OSError:
            # Audit emission should never break notebook mutations in constrained envs.
            return

    def _load_manifest(self) -> NotebookManifest:
        if not self.manifest_path.exists():
            manifest = create_default_manifest(grid=self.grid_config)
            self._save_manifest(manifest)
            return manifest
        return NotebookManifest.model_validate_json(self.manifest_path.read_text(encoding='utf-8'))

    def _save_manifest(self, manifest: NotebookManifest) -> None:
        self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest.updated_at = utc_now()
        with tempfile.NamedTemporaryFile('w', delete=False, encoding='utf-8', dir=self.manifest_path.parent) as tmp:
            tmp.write(json.dumps(manifest.model_dump(mode='json'), indent=2))
            tmp_path = Path(tmp.name)
        tmp_path.replace(self.manifest_path)
        self._manifest = manifest

    def startup_preflight(self) -> HealthStatus:
        for path in (self.schema_path, self.bridge_schema_path, self.manifest_schema_path):
            if not path.exists():
                raise RuntimeError(f'Missing required schema file: {path}')

        craft = self.craft_renderer.preflight()
        if self.craft_required and not craft.ready:
            raise RuntimeError(craft.detail)

        return HealthStatus(
            craft_ready=craft.ready,
            craft_detail=craft.detail,
            manifest_path=str(self.manifest_path),
            schema_path=str(self.manifest_schema_path),
            bridge_schema_path=str(self.bridge_schema_path),
            current_revision_id=self._manifest.current_revision_id,
        )

    def health_status(self) -> HealthStatus:
        craft = self.craft_renderer.preflight()
        return HealthStatus(
            craft_ready=craft.ready,
            craft_detail=craft.detail,
            manifest_path=str(self.manifest_path),
            schema_path=str(self.manifest_schema_path),
            bridge_schema_path=str(self.bridge_schema_path),
            current_revision_id=self._manifest.current_revision_id,
        )

    def get_manifest(self) -> NotebookManifest:
        return self._manifest.model_copy(deep=True)

    def get_grid(self) -> GridConfig:
        return self._manifest.grid

    def list_blocks(self) -> list[Block]:
        return list(self._manifest.blocks)

    def list_revisions(self, *, limit: int = 20) -> list[NotebookRevision]:
        return list(self._manifest.revisions[-limit:])

    def list_events(self, *, limit: int = 50) -> list[NotebookEvent]:
        return list(self._manifest.events[-limit:])

    def _check_expected_revision(self, expected_revision_id: str | None) -> None:
        if expected_revision_id and expected_revision_id != self._manifest.current_revision_id:
            raise ValueError('Revision conflict: expected revision does not match current head')

    def replace_manifest(
        self,
        manifest: NotebookManifest,
        *,
        expected_revision_id: str | None,
        actor: str,
    ) -> NotebookManifest:
        self._check_expected_revision(expected_revision_id)
        manifest.schema_version = 'notebook-manifest-v1'
        self._record_revision(manifest, actor=actor, kind='manifest.replace', summary='Replaced manifest', data={})
        self._save_manifest(manifest)
        return manifest.model_copy(deep=True)

    def create_block(
        self,
        payload: BlockCreate,
        *,
        actor: str = 'api',
        expected_revision_id: str | None = None,
    ) -> tuple[NotebookManifest, Block]:
        self._check_expected_revision(expected_revision_id)
        manifest = self.get_manifest()
        bounds, label, tone = normalize_block_create(payload, margin_cols=manifest.grid.margin_cols)
        grid = UniversalGrid(manifest.grid)
        bounds = grid.clamp_bounds(bounds)
        block = Block.from_bounds(str(uuid4()), bounds, label=label, tone=tone)
        manifest.blocks.append(block)
        self._record_revision(
            manifest,
            actor=actor,
            kind='block.created',
            summary=f'Created block {block.id}',
            data={'block': block.model_dump(mode='json')},
        )
        self._save_manifest(manifest)
        self.emit_audit_event(
            tool='block.create',
            metadata={'kind': 'block.created', 'revisionId': manifest.current_revision_id, 'blockId': block.id},
        )
        return manifest, block

    def delete_block(
        self,
        block_id: str,
        *,
        actor: str = 'api',
        expected_revision_id: str | None = None,
    ) -> tuple[NotebookManifest, bool]:
        self._check_expected_revision(expected_revision_id)
        manifest = self.get_manifest()
        remaining = [block for block in manifest.blocks if block.id != block_id]
        if len(remaining) == len(manifest.blocks):
            return manifest, False
        manifest.blocks = remaining
        self._record_revision(
            manifest,
            actor=actor,
            kind='block.deleted',
            summary=f'Deleted block {block_id}',
            data={'block_id': block_id},
        )
        self._save_manifest(manifest)
        self.emit_audit_event(
            tool='block.delete',
            metadata={'kind': 'block.deleted', 'revisionId': manifest.current_revision_id, 'blockId': block_id},
        )
        return manifest, True

    def clear_blocks(self, *, actor: str = 'api', expected_revision_id: str | None = None) -> NotebookManifest:
        self._check_expected_revision(expected_revision_id)
        manifest = self.get_manifest()
        manifest.blocks = []
        self._record_revision(manifest, actor=actor, kind='blocks.cleared', summary='Cleared all blocks', data={})
        self._save_manifest(manifest)
        self.emit_audit_event(
            tool='block.clear',
            metadata={'kind': 'blocks.cleared', 'revisionId': manifest.current_revision_id},
        )
        return manifest

    def export_markdown(self) -> str:
        manifest = self.get_manifest()
        lines = [
            '# LO7 Notebook Export',
            '',
            f'- Notebook: `{manifest.notebook_id}`',
            f'- Revision: `{manifest.current_revision_id}`',
            '',
            '| Block | Col Range | Row Range | Label | Tone |',
            '|-------|-----------|-----------|-------|------|',
        ]
        for block in manifest.blocks:
            lines.append(
                f'| {block.id[:8]} | {block.min_col}-{block.max_col} | {block.min_row}-{block.max_row} | {block.label or "-"} | {block.tone} |'
            )
        return '\n'.join(lines)

    def _validate_csv_row(
        self,
        row: dict[str, str | None],
        *,
        row_index: int,
        margin_cols: int,
        grid: UniversalGrid,
    ) -> tuple[Block | None, list[dict[str, Any]]]:
        errors: list[dict[str, Any]] = []

        # 1. Validate required columns are present
        required = ('min_col', 'max_col', 'min_row', 'max_row')
        for field in required:
            raw = row.get(field)
            if raw is None or str(raw).strip() == '':
                errors.append({
                    'row': row_index,
                    'field': field,
                    'message': f'Missing or empty {field}',
                })
        if errors:
            return None, errors

        # 2. Parse integers per column (collect all parse errors before returning)
        int_fields = {
            'min_col': 'min_col',
            'max_col': 'max_col',
            'min_row': 'min_row',
            'max_row': 'max_row',
        }
        parsed: dict[str, int] = {}
        for field_key, label in int_fields.items():
            raw = row.get(field_key, '')
            try:
                parsed[field_key] = int(str(raw).strip())
            except (ValueError, TypeError):
                errors.append({
                    'row': row_index,
                    'field': field_key,
                    'message': f'{label} must be an integer',
                })

        if errors:
            return None, errors

        # 3. Validate bounds relationships and grid constraints
        try:
            bounds = BlockBounds(
                min_col=parsed['min_col'],
                max_col=parsed['max_col'],
                min_row=parsed['min_row'],
                max_row=parsed['max_row'],
            )
        except (TypeError, ValueError) as exc:
            return None, [{
                'row': row_index,
                'field': 'bounds',
                'message': f'Invalid bounds: {exc}',
            }]

        if bounds.min_col < margin_cols:
            errors.append({
                'row': row_index,
                'field': 'min_col',
                'message': f'min_col must be >= margin_cols ({margin_cols})',
            })
        if bounds.min_col > bounds.max_col:
            errors.append({
                'row': row_index,
                'field': 'max_col',
                'message': 'min_col must be <= max_col',
            })
        if bounds.min_row > bounds.max_row:
            errors.append({
                'row': row_index,
                'field': 'max_row',
                'message': 'min_row must be <= max_row',
            })

        max_grid_col = (grid.config.cols - 1) if grid.config.cols is not None else None
        max_grid_row = (grid.config.rows - 1) if grid.config.rows is not None else None
        if max_grid_col is not None and bounds.max_col > max_grid_col:
            errors.append({
                'row': row_index,
                'field': 'max_col',
                'message': f'max_col exceeds grid width ({max_grid_col})',
            })
        if max_grid_row is not None and bounds.max_row > max_grid_row:
            errors.append({
                'row': row_index,
                'field': 'max_row',
                'message': f'max_row exceeds grid height ({max_grid_row})',
            })

        if errors:
            return None, errors

        # 4. Validate tone against allowed set (default to amber if missing/empty)
        label = str(row.get('label') or '').strip()
        tone_raw = str(row.get('tone') or 'amber').strip().lower() or 'amber'
        if tone_raw not in ALLOWED_TONES:
            return None, [{
                'row': row_index,
                'field': 'tone',
                'message': f'tone must be one of: {", ".join(sorted(ALLOWED_TONES))}',
            }]

        # 5. Clamp to grid and construct block
        clamped = grid.clamp_bounds(bounds)
        block = Block.from_bounds(str(uuid4()), clamped, label=label, tone=tone_raw)
        return block, []

    def _validate_csv_header(
        self,
        fieldnames: list[str] | None,
    ) -> list[dict[str, Any]]:
        """Validate that required columns are present in the CSV header."""
        errors: list[dict[str, Any]] = []
        if not fieldnames:
            errors.append({'row': 1, 'field': 'header', 'message': 'Missing or empty header row'})
            return errors
        required = frozenset({'min_col', 'max_col', 'min_row', 'max_row'})
        present = frozenset(c.strip().lower() for c in fieldnames)
        missing = required - present
        if missing:
            for field in sorted(missing):
                errors.append({'row': 1, 'field': field, 'message': f'Missing required column: {field}'})
        return errors

    def import_csv(
        self,
        csv_text: str,
        *,
        dry_run: bool,
        partial: bool = False,
        actor: str = 'api',
        expected_revision_id: str | None = None,
    ) -> dict[str, Any]:
        self._check_expected_revision(expected_revision_id)

        # 1. Parse and validate header
        reader = csv.DictReader(StringIO(csv_text))
        header_errors = self._validate_csv_header(reader.fieldnames)
        if header_errors:
            return {
                'dry_run': dry_run,
                'valid_count': 0,
                'invalid_count': 0,
                'imported_count': 0,
                'skipped_count': 0,
                'errors': header_errors,
                'blocks': [],
                'aborted': True,
                'header_errors': header_errors,
            }

        rows = list(reader)
        if not rows:
            return {
                'dry_run': dry_run,
                'valid_count': 0,
                'invalid_count': 0,
                'imported_count': 0,
                'skipped_count': 0,
                'errors': [],
                'blocks': [],
            }

        manifest = self.get_manifest()
        grid = UniversalGrid(manifest.grid)
        margin_cols = manifest.grid.margin_cols
        imported: list[Block] = []
        errors: list[dict[str, Any]] = []

        # 2. Validate each row (collect ALL errors, don't short-circuit)
        for index, row in enumerate(rows, start=2):
            normalized = {
                str(key).strip(): ('' if value is None else str(value).strip())
                for key, value in row.items()
            }
            block, row_errors = self._validate_csv_row(
                normalized,
                row_index=index,
                margin_cols=margin_cols,
                grid=grid,
            )
            if row_errors:
                errors.extend(row_errors)
                continue
            imported.append(block)

        valid_count = len(imported)
        invalid_count = len(rows) - valid_count
        skipped = invalid_count

        # 3. Decide outcome based on mode
        if dry_run:
            return {
                'dry_run': True,
                'valid_count': valid_count,
                'invalid_count': invalid_count,
                'imported_count': 0,
                'skipped_count': skipped,
                'errors': errors,
                'blocks': [block.model_dump(mode='json') for block in imported],
            }

        # reject_on_error: if errors exist and not partial, abort
        if errors and not partial:
            return {
                'dry_run': False,
                'valid_count': valid_count,
                'invalid_count': invalid_count,
                'imported_count': 0,
                'skipped_count': skipped,
                'errors': errors,
                'blocks': [],
                'aborted': True,
            }

        if not imported:
            return {
                'dry_run': False,
                'valid_count': valid_count,
                'invalid_count': invalid_count,
                'imported_count': 0,
                'skipped_count': skipped,
                'errors': errors,
                'blocks': [],
            }

        manifest.blocks.extend(imported)
        summary = f'Imported {len(imported)} blocks from CSV'
        if errors:
            summary += f' ({skipped} rows skipped)'
        self._record_revision(
            manifest,
            actor=actor,
            kind='blocks.csv_imported',
            summary=summary,
            data={'count': len(imported), 'skipped': skipped, 'partial': bool(errors)},
        )
        self._save_manifest(manifest)
        self.emit_audit_event(
            tool='csv.import',
            metadata={
                'kind': 'blocks.csv_imported',
                'revisionId': manifest.current_revision_id,
                'count': len(imported),
                'skipped': skipped,
            },
        )
        return {
            'dry_run': False,
            'valid_count': valid_count,
            'invalid_count': invalid_count,
            'imported_count': len(imported),
            'skipped_count': skipped,
            'errors': errors,
            'blocks': [block.model_dump(mode='json') for block in imported],
        }

    def render_heatmap_html(self) -> str:
        manifest = self.get_manifest()
        grid = UniversalGrid(manifest.grid)
        occupied_cells = sum(grid.cell_count(block.to_bounds()) for block in manifest.blocks)
        density = round(occupied_cells / max(grid.board_capacity(), 1), 4)
        blocks_markup = '\n'.join(
            f'<li><strong>{block.label or block.id[:8]}</strong> <span>{block.tone}</span> ({block.min_col},{block.min_row})→({block.max_col},{block.max_row})</li>'
            for block in manifest.blocks
        )
        return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LO7 Heatmap</title>
  <style>
    :root {{
      --bg: #081019;
      --panel: rgba(13, 25, 41, 0.92);
      --text: #ecf7ff;
      --muted: #8fa3bd;
      --accent: #ffb703;
    }}
    body {{
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at top left, rgba(255,183,3,0.22), transparent 38%),
        radial-gradient(circle at bottom right, rgba(46,196,182,0.18), transparent 34%),
        var(--bg);
      color: var(--text);
      font-family: "Manrope", sans-serif;
      padding: 32px;
    }}
    .panel {{
      max-width: 820px;
      margin: 0 auto;
      background: var(--panel);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px;
      padding: 24px;
      backdrop-filter: blur(12px);
    }}
    h1 {{
      font-family: "Space Grotesk", sans-serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin: 0 0 12px;
    }}
    ul {{
      padding-left: 18px;
      color: var(--muted);
    }}
    li span {{
      color: var(--accent);
    }}
  </style>
</head>
<body>
  <section class="panel">
    <h1>LO7 Heatmap</h1>
    <p>Notebook <strong>{manifest.notebook_id}</strong> at revision <strong>{manifest.current_revision_id}</strong>.</p>
    <p>Occupied density: <strong>{density:.2%}</strong> across {len(manifest.blocks)} blocks.</p>
    <ul>{blocks_markup}</ul>
  </section>
</body>
</html>"""

    def derive_metrics(self) -> CompassMetrics:
        manifest = self.get_manifest()
        grid = UniversalGrid(manifest.grid)
        block_areas = [grid.cell_count(block.to_bounds()) for block in manifest.blocks]
        board_capacity = max(grid.board_capacity(), 1)
        total_area = sum(block_areas)
        density = round(total_area / board_capacity, 4)
        tone_counts: dict[str, int] = {}
        margin_aligned = 0
        dispersion_acc = 0.0
        centers: list[tuple[float, float]] = []
        for block in manifest.blocks:
            tone_counts[block.tone] = tone_counts.get(block.tone, 0) + 1
            if block.min_col >= manifest.grid.margin_cols:
                margin_aligned += 1
            center_x = (block.min_col + block.max_col) / 2
            center_y = (block.min_row + block.max_row) / 2
            centers.append((center_x, center_y))
            dispersion_acc += abs(center_x - manifest.grid.margin_cols) + center_y

        tone_distribution = {
            tone: round(count / max(len(manifest.blocks), 1), 4)
            for tone, count in tone_counts.items()
        }
        cluster_spread = 0.0
        if len(centers) > 1:
            mean_x = sum(point[0] for point in centers) / len(centers)
            mean_y = sum(point[1] for point in centers) / len(centers)
            cluster_spread = round(
                sum(abs(point[0] - mean_x) + abs(point[1] - mean_y) for point in centers)
                / (len(centers) * max((manifest.grid.cols or 40) + (manifest.grid.rows or 30), 1)),
                4,
            )

        recent_events = self.list_events(limit=10)
        gesture_velocity = round(
            min(1.0, sum(1 for event in recent_events if event.kind.startswith('block.')) / 10),
            4,
        )
        revision_churn = round(min(1.0, len(self._manifest.revisions) / 25), 4)
        block_dispersion = round(min(1.0, dispersion_acc / max(len(manifest.blocks), 1) / 50), 4)
        margin_adherence = round(margin_aligned / max(len(manifest.blocks), 1), 4)

        return CompassMetrics(
            density=density,
            tone_distribution=tone_distribution,
            cluster_spread=cluster_spread,
            margin_adherence=margin_adherence,
            gesture_velocity_proxy=gesture_velocity,
            revision_churn=revision_churn,
            block_dispersion=block_dispersion,
            block_count=len(manifest.blocks),
            block_area_total=total_area,
        )

    def render_compass(self, *, profile: str, actor: str = 'api') -> dict[str, Any]:
        manifest = self.get_manifest()
        metrics = self.derive_metrics()
        output_dir = self.manifest_path.parent / 'artifacts'
        result = self.craft_renderer.render(manifest=manifest, metrics=metrics, profile=profile, output_dir=output_dir)
        artifact = result.to_artifact()
        manifest.integration.compass.renderer = result.renderer
        manifest.integration.compass.last_profile = profile
        manifest.integration.compass.last_rendered_at = artifact.created_at
        manifest.integration.compass.last_error = None
        manifest.integration.compass.last_metrics = metrics
        manifest.integration.compass.last_artifacts = [artifact]
        self._record_revision(
            manifest,
            actor=actor,
            kind='compass.rendered',
            summary=f'Rendered compass profile {profile}',
            data={'profile': profile, 'artifact': artifact.model_dump(mode='json')},
        )
        self._save_manifest(manifest)
        self.emit_audit_event(
            tool='compass.render',
            metadata={'kind': 'compass.rendered', 'revisionId': manifest.current_revision_id, 'profile': profile},
        )
        return {
            'profile': profile,
            'renderer': result.renderer,
            'artifact': artifact.model_dump(mode='json'),
            'metrics': metrics.model_dump(mode='json'),
        }

    def compass_status(self) -> dict[str, Any]:
        manifest = self.get_manifest()
        compass = manifest.integration.compass
        return compass.model_dump(mode='json')

    def build_bridge_payload(self) -> GruffCompassPayload:
        manifest = self.get_manifest()
        metrics = manifest.integration.compass.last_metrics or self.derive_metrics()
        render_artifact = manifest.integration.compass.last_artifacts[0] if manifest.integration.compass.last_artifacts else None
        return build_gruff_payload(manifest=manifest, metrics=metrics, render_artifact=render_artifact)

    def emit_bridge_payload(self, *, actor: str = 'api') -> dict[str, Any]:
        manifest = self.get_manifest()
        payload = self.build_bridge_payload()
        artifact = persist_payload(payload, output_dir=self.manifest_path.parent / 'bridge')
        manifest.integration.bridge_payload_ref = artifact
        self._record_revision(
            manifest,
            actor=actor,
            kind='bridge.payload_emitted',
            summary='Emitted Gruff bridge payload',
            data={'artifact': artifact.model_dump(mode='json')},
        )
        self._save_manifest(manifest)
        self.emit_audit_event(
            tool='bridge.emit',
            metadata={'kind': 'bridge.payload_emitted', 'revisionId': manifest.current_revision_id},
        )
        return {'payload': payload.model_dump(mode='json'), 'artifact': artifact.model_dump(mode='json')}

    def latest_bridge_payload(self) -> dict[str, Any] | None:
        artifact = self._manifest.integration.bridge_payload_ref
        if not artifact:
            return None
        path = Path(artifact.path)
        if not path.exists():
            return {'artifact': artifact.model_dump(mode='json'), 'missing': True}
        return {'artifact': artifact.model_dump(mode='json'), 'payload': json.loads(path.read_text(encoding='utf-8'))}

    def _append_history_archive(self, revisions: list[NotebookRevision], events: list[NotebookEvent]) -> None:
        if not revisions:
            return
        self._history_archive_path.parent.mkdir(parents=True, exist_ok=True)
        with self._history_archive_path.open('a', encoding='utf-8') as handle:
            for revision, event in zip(revisions, events, strict=True):
                handle.write(
                    json.dumps(
                        {
                            'archived_at': utc_now(),
                            'revision': revision.model_dump(mode='json'),
                            'event': event.model_dump(mode='json'),
                        }
                    )
                    + '\n'
                )

    def _maybe_compact_history(self, manifest: NotebookManifest) -> None:
        cap = self._max_inline_history
        if len(manifest.revisions) <= cap:
            return
        overflow = len(manifest.revisions) - cap
        rev_batch = manifest.revisions[:overflow]
        evt_batch = manifest.events[:overflow]
        self._append_history_archive(rev_batch, evt_batch)
        manifest.revisions = manifest.revisions[overflow:]
        manifest.events = manifest.events[overflow:]

    def _record_revision(
        self,
        manifest: NotebookManifest,
        *,
        actor: str,
        kind: str,
        summary: str,
        data: dict[str, Any],
    ) -> None:
        parent = manifest.current_revision_id
        # Use monotonic counters — never derive from len()
        revision_number = manifest.next_revision_number
        event_sequence = manifest.next_event_sequence
        manifest.next_revision_number = revision_number + 1
        manifest.next_event_sequence = event_sequence + 1
        snapshot_hash = sha256(
            json.dumps(
                {
                    'grid': manifest.grid.model_dump(mode='json'),
                    'blocks': [block.model_dump(mode='json') for block in manifest.blocks],
                    'integration': manifest.integration.model_dump(mode='json'),
                    'kind': kind,
                    'summary': summary,
                    'parent': parent,
                },
                sort_keys=True,
            ).encode('utf-8')
        ).hexdigest()
        event_id = f'evt-{sha256(json.dumps({"kind": kind, "data": data, "revision": revision_number}, sort_keys=True).encode("utf-8")).hexdigest()[:16]}'
        revision_id = f'rev-{sha256(f"{revision_number}:{parent}:{snapshot_hash}".encode("utf-8")).hexdigest()[:16]}'
        event = NotebookEvent(
            event_id=event_id,
            revision_id=revision_id,
            actor=actor,
            kind=kind,
            summary=summary,
            data=data,
        )
        revision = NotebookRevision(
            revision_id=revision_id,
            number=revision_number,
            parent_revision_id=parent,
            actor=actor,
            summary=summary,
            event_id=event.event_id,
            snapshot_hash=snapshot_hash,
        )
        manifest.events.append(event)
        manifest.revisions.append(revision)
        manifest.current_revision_id = revision.revision_id
        self._maybe_compact_history(manifest)

    # ─────────────────────────────────────────────────────────────
    # Compaction / Retention
    # ─────────────────────────────────────────────────────────────

    def estimate_compaction(self) -> dict[str, Any]:
        """Return projected counts/IDs to prune/archive without making changes."""
        manifest = self._manifest
        keep_count = min(manifest.max_revisions, len(manifest.revisions))
        # Always keep the newest `max_revisions` — never use len()-based formula
        candidate_revisions = manifest.revisions[: len(manifest.revisions) - keep_count]
        # Only archive events whose revision is being pruned
        pruned_event_ids = {r.event_id for r in candidate_revisions}
        orphaned_events = manifest.events[: len(manifest.events) - keep_count]
        orphaned_events = [e for e in orphaned_events if e.event_id in pruned_event_ids]
        excess_revs = len(candidate_revisions)
        excess_evts = len(orphaned_events)
        return {
            'manifest_path': str(self.manifest_path),
            'pruned_revisions': [r.model_dump(mode='json') for r in candidate_revisions],
            'pruned_events': [e.model_dump(mode='json') for e in orphaned_events],
            'counts': {
                'pruned_revisions': len(candidate_revisions),
                'pruned_events': len(orphaned_events),
                'excess_revisions': excess_revs,
                'excess_events': excess_evts,
            },
            'current_revision_id': manifest.current_revision_id,
            'head_revision_number': manifest.revisions[-1].number if manifest.revisions else 0,
            'next_revision_number': manifest.next_revision_number,
            'next_event_sequence': manifest.next_event_sequence,
        }

    def compact(self, *, dry_run: bool = False) -> dict[str, Any]:
        """Execute compaction: archive pruned records, rewrite manifest atomically.

        Order for crash safety:
        1. Write archive artifact
        2. fsync/flush
        3. Atomically replace manifest

        On failure, manifest remains untouched.
        """
        manifest = self._manifest

        if dry_run:
            return self.estimate_compaction()

        # Determine how many newest to keep and how many to prune
        excess_revs = len(manifest.revisions) - manifest.max_revisions
        prune_revisions = manifest.revisions[: max(0, excess_revs)]

        if not prune_revisions:
            return {
                'dry_run': False,
                'pruned_revisions': 0,
                'pruned_events': 0,
                'archive_path': manifest.archive_path,
                'current_revision_id': manifest.current_revision_id,
                'message': 'No compaction needed',
            }

        # Identify orphaned events: those whose revision is being pruned
        prune_event_count = excess_revs
        prune_events = manifest.events[:prune_event_count]
        pruned_event_ids = {r.event_id for r in prune_revisions}
        orphaned_events = [e for e in prune_events if e.event_id in pruned_event_ids]

        # Build archive payload
        archive_payload = {
            'archived_at': utc_now(),
            'notebook_id': manifest.notebook_id,
            'pruned_revisions': [r.model_dump(mode='json') for r in prune_revisions],
            'pruned_events': [e.model_dump(mode='json') for e in orphaned_events],
        }

        # Determine archive path
        if manifest.archive_path:
            archive_path = Path(manifest.archive_path)
        else:
            archive_path = self.manifest_path.with_suffix('.archive.json')

        # Step 1: Write archive (temp file first for atomicity)
        try:
            tmp_archive_path = archive_path.with_suffix('.tmp')
            tmp_archive_path.parent.mkdir(parents=True, exist_ok=True)
            with open(tmp_archive_path, 'w', encoding='utf-8') as fh:
                fh.write(json.dumps(archive_payload, indent=2))
                fh.flush()
                os.fsync(fh.fileno())
            os.rename(tmp_archive_path, archive_path)
            # fsync parent dir to persist the rename
            dir_fd = os.open(archive_path.parent, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
        except OSError as exc:
            raise RuntimeError(f'Failed to write archive: {exc}') from exc

        # Step 2: Create new manifest with pruned arrays
        compacted = manifest.model_copy(deep=True)
        compacted.revisions = compacted.revisions[excess_revs:]
        compacted.events = compacted.events[excess_revs:]
        compacted.archive_path = str(archive_path)
        compacted.updated_at = utc_now()
        # Counters unchanged (monotonic — next write uses incremented value)

        # Step 3: Atomically replace manifest (existing _save_manifest pattern)
        tmp_manifest_path = self.manifest_path.with_suffix('.tmp')
        try:
            tmp_manifest_path.parent.mkdir(parents=True, exist_ok=True)
            with open(tmp_manifest_path, 'w', encoding='utf-8') as mh:
                mh.write(json.dumps(compacted.model_dump(mode='json'), indent=2))
                mh.flush()
                os.fsync(mh.fileno())
            os.rename(tmp_manifest_path, self.manifest_path)
            dir_fd = os.open(self.manifest_path.parent, os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)
            self._manifest = compacted
        except OSError as exc:
            # Clean up partial manifest write
            if tmp_manifest_path.exists():
                tmp_manifest_path.unlink()
            raise RuntimeError(f'Failed to write manifest: {exc}') from exc

        return {
            'dry_run': False,
            'pruned_revisions': len(prune_revisions),
            'pruned_events': len(orphaned_events),
            'archive_path': str(archive_path),
            'current_revision_id': compacted.current_revision_id,
            'head_revision_number': compacted.revisions[-1].number if compacted.revisions else None,
            'next_revision_number': compacted.next_revision_number,
            'next_event_sequence': compacted.next_event_sequence,
        }
