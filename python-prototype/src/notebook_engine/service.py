from __future__ import annotations

import csv
import json
import tempfile
from dataclasses import dataclass
from hashlib import sha256
from io import StringIO
from pathlib import Path
from typing import Any
from uuid import uuid4

from notebook_engine.blocks import Block, BlockCreate, BlockValidationError, normalize_block_create, utc_now
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
    ) -> None:
        self.manifest_path = manifest_path
        self.grid_config = grid_config or GridConfig()
        self.craft_renderer = craft_renderer
        self.schema_path = schema_path
        self.bridge_schema_path = bridge_schema_path
        self.manifest_schema_path = manifest_schema_path
        self.craft_required = craft_required
        self._manifest = self._load_manifest()

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

    def replace_manifest(
        self,
        manifest: NotebookManifest,
        *,
        expected_revision_id: str | None,
        actor: str,
    ) -> NotebookManifest:
        if expected_revision_id and expected_revision_id != self._manifest.current_revision_id:
            raise ValueError('Revision conflict: expected revision does not match current head')
        manifest.schema_version = 'notebook-manifest-v1'
        self._record_revision(manifest, actor=actor, kind='manifest.replace', summary='Replaced manifest', data={})
        self._save_manifest(manifest)
        return manifest.model_copy(deep=True)

    def create_block(self, payload: BlockCreate, *, actor: str = 'api') -> tuple[NotebookManifest, Block]:
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
        return manifest, block

    def delete_block(self, block_id: str, *, actor: str = 'api') -> tuple[NotebookManifest, bool]:
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
        return manifest, True

    def clear_blocks(self, *, actor: str = 'api') -> NotebookManifest:
        manifest = self.get_manifest()
        manifest.blocks = []
        self._record_revision(manifest, actor=actor, kind='blocks.cleared', summary='Cleared all blocks', data={})
        self._save_manifest(manifest)
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

    def import_csv(self, csv_text: str, *, dry_run: bool, actor: str = 'api') -> dict[str, Any]:
        manifest = self.get_manifest()
        rows = list(csv.DictReader(StringIO(csv_text)))
        imported: list[Block] = []
        for index, row in enumerate(rows):
            bounds = BlockBounds(
                min_col=int(row['min_col']),
                max_col=int(row['max_col']),
                min_row=int(row['min_row']),
                max_row=int(row['max_row']),
            )
            imported.append(
                Block.from_bounds(
                    str(uuid4()),
                    bounds,
                    label=row.get('label', '').strip(),
                    tone=row.get('tone', 'amber').strip().lower() or 'amber',
                )
            )
        if dry_run:
            return {'dry_run': True, 'count': len(imported), 'blocks': [block.model_dump(mode='json') for block in imported]}

        manifest.blocks.extend(imported)
        self._record_revision(
            manifest,
            actor=actor,
            kind='blocks.csv_imported',
            summary=f'Imported {len(imported)} blocks from CSV',
            data={'count': len(imported)},
        )
        self._save_manifest(manifest)
        return {'dry_run': False, 'count': len(imported), 'blocks': [block.model_dump(mode='json') for block in imported]}

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
        return {'payload': payload.model_dump(mode='json'), 'artifact': artifact.model_dump(mode='json')}

    def latest_bridge_payload(self) -> dict[str, Any] | None:
        artifact = self._manifest.integration.bridge_payload_ref
        if not artifact:
            return None
        path = Path(artifact.path)
        if not path.exists():
            return {'artifact': artifact.model_dump(mode='json'), 'missing': True}
        return {'artifact': artifact.model_dump(mode='json'), 'payload': json.loads(path.read_text(encoding='utf-8'))}

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
        revision_number = len(manifest.revisions)
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
