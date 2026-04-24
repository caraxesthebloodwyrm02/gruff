"""Shared test doubles for notebook-engine integration tests."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from notebook_engine.craft import CraftPreflight, CraftRenderResult
from notebook_engine.grid import GridConfig
from notebook_engine.service import NotebookService


class FakeCraftRenderer:
    def __init__(self, tmp_path: Path, *, fail_profiles: frozenset[str] | None = None):
        self.tmp_path = tmp_path
        self.fail_profiles = fail_profiles or frozenset()

    def preflight(self) -> CraftPreflight:
        return CraftPreflight(True, 'craft-server', 'fake renderer ready')

    def render(self, *, manifest, metrics, profile, output_dir):
        if profile in self.fail_profiles:
            raise RuntimeError('forced craft failure for tests')
        output_dir.mkdir(parents=True, exist_ok=True)
        artifact_path = output_dir / f'{manifest.notebook_id}-{profile}.png'
        artifact_path.write_text('fake-render', encoding='utf-8')
        return CraftRenderResult(
            renderer='craft-server',
            profile=profile,
            artifact_path=str(artifact_path),
            metadata={'fake': True, 'revision': manifest.current_revision_id},
        )


def make_notebook_service(tmp_path: Path, **kwargs: Any) -> NotebookService:
    root = Path(__file__).resolve().parents[3]
    params: dict[str, Any] = {
        'manifest_path': tmp_path / 'notebook.manifest.json',
        'grid_config': GridConfig(cell_px=24, margin_cols=2, cols=40, rows=30),
        'craft_renderer': FakeCraftRenderer(tmp_path),
        'schema_path': root / 'schemas' / 'trust-event-v1.schema.json',
        'bridge_schema_path': root / 'schemas' / 'gruff-proportion-v1.schema.json',
        'manifest_schema_path': root / 'schemas' / 'notebook-manifest-v1.schema.json',
        'craft_required': True,
        'audit_enabled': False,
    }
    params.update(kwargs)
    return NotebookService(**params)
