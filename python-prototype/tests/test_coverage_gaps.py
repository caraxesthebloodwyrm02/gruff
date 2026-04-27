"""Comprehensive gap-fill tests targeting every remaining uncovered branch.

Coverage targets:
  blocks.py   83% → 95%+  (to_request_error, _field_for_bounds_error, InMemoryBlockStore, create_block_for_grid)
  service.py  94% → 97%+  (derive_metrics edge, compact, render_heatmap_html, latest_bridge_payload)
  craft.py    67% → 75%+  (preflight empty-after-split)
  grid.py     98% → 100%  (normalize_bounds)
  manifest.py 96% → 100%  (head_revision branches, counter accessors)
"""

from __future__ import annotations

import json
from pathlib import Path
from uuid import uuid4

import pytest
from pydantic import ValidationError

from notebook_engine.blocks import (
    ALLOWED_TONES,
    Block,
    BlockCreate,
    BlockValidationError,
    InMemoryBlockStore,
    _field_for_bounds_error,
    create_block_for_grid,
    normalize_block_create,
)
from notebook_engine.craft import CommandCraftRenderer
from notebook_engine.grid import BlockBounds, CellCoord, GridConfig, UniversalGrid
from notebook_engine.manifest import (
    CompassMetrics,
    NotebookManifest,
    create_default_manifest,
)
from notebook_engine.test_doubles import FakeCraftRenderer, make_notebook_service


# ═══════════════════════════════════════════════════════════════════════════
# blocks.py — BlockValidationError.to_request_error()
# ═══════════════════════════════════════════════════════════════════════════


class TestBlockValidationErrorRequestFormat:
    def test_to_request_error_with_field(self):
        err = BlockValidationError('bad value', field='min_col', input_value=0)
        out = err.to_request_error()
        assert out['type'] == 'value_error'
        assert out['loc'] == ('body', 'min_col')
        assert 'bad value' in out['msg']
        assert out['input'] == 0
        assert out['ctx']['error'] == 'bad value'

    def test_to_request_error_without_field(self):
        err = BlockValidationError('generic error', field=None, input_value=None)
        out = err.to_request_error()
        assert out['loc'] == ('body',)
        assert out['input'] is None


# ═══════════════════════════════════════════════════════════════════════════
# blocks.py — _field_for_bounds_error()
# ═══════════════════════════════════════════════════════════════════════════


class TestFieldForBoundsError:
    def test_min_col_message(self):
        assert _field_for_bounds_error('min_col must be <= max_col') == 'max_col'

    def test_min_row_message(self):
        assert _field_for_bounds_error('min_row must be <= max_row') == 'max_row'

    def test_unrecognized_message(self):
        assert _field_for_bounds_error('something else entirely') is None


# ═══════════════════════════════════════════════════════════════════════════
# blocks.py — InMemoryBlockStore
# ═══════════════════════════════════════════════════════════════════════════


class TestInMemoryBlockStore:
    def test_list_empty(self):
        store = InMemoryBlockStore()
        assert store.list() == []

    def test_create_and_list(self):
        store = InMemoryBlockStore()
        bounds = BlockBounds(min_col=2, max_col=5, min_row=1, max_row=3)
        block = store.create(bounds, label='Test', tone='amber')
        assert block.label == 'Test'
        assert len(store.list()) == 1
        assert store.list()[0].id == block.id

    def test_delete_existing_returns_true(self):
        store = InMemoryBlockStore()
        bounds = BlockBounds(min_col=2, max_col=5, min_row=1, max_row=3)
        block = store.create(bounds, label='Del', tone='mint')
        assert store.delete(block.id) is True
        assert store.list() == []

    def test_delete_nonexistent_returns_false(self):
        store = InMemoryBlockStore()
        assert store.delete('nonexistent-id') is False

    def test_clear_removes_all(self):
        store = InMemoryBlockStore()
        bounds = BlockBounds(min_col=2, max_col=5, min_row=1, max_row=3)
        store.create(bounds, label='A', tone='amber')
        store.create(bounds, label='B', tone='mint')
        assert len(store.list()) == 2
        store.clear()
        assert store.list() == []


# ═══════════════════════════════════════════════════════════════════════════
# blocks.py — create_block_for_grid()
# ═══════════════════════════════════════════════════════════════════════════


class TestCreateBlockForGrid:
    def test_happy_path(self):
        store = InMemoryBlockStore()
        payload = BlockCreate(min_col=2, max_col=5, min_row=1, max_row=3, tone='azure')
        block = create_block_for_grid(store, payload, margin_cols=2)
        assert block.tone == 'azure'
        assert len(store.list()) == 1

    def test_margin_violation_raises(self):
        store = InMemoryBlockStore()
        payload = BlockCreate(min_col=0, max_col=5, min_row=1, max_row=3)
        with pytest.raises(BlockValidationError, match='margin_cols'):
            create_block_for_grid(store, payload, margin_cols=2)


# ═══════════════════════════════════════════════════════════════════════════
# blocks.py — normalize_block_create edge cases (lines 170, 172)
# ═══════════════════════════════════════════════════════════════════════════


class TestNormalizeBlockCreateEdgeCases:
    def test_incomplete_bounds_raises(self):
        with pytest.raises(ValidationError):
            BlockCreate(min_col=2, max_col=5)

    def test_incomplete_start_end_raises(self):
        with pytest.raises(ValidationError):
            BlockCreate(start_col=2, start_row=1)

    def test_no_shape_at_all_raises(self):
        with pytest.raises(ValidationError):
            BlockCreate()

    def test_all_allowed_tones(self):
        for tone in ALLOWED_TONES:
            payload = BlockCreate(min_col=2, max_col=5, min_row=1, max_row=3, tone=tone)
            _, _, t = normalize_block_create(payload, margin_cols=2)
            assert t == tone


# ═══════════════════════════════════════════════════════════════════════════
# grid.py — normalize_bounds() (line 62)
# ═══════════════════════════════════════════════════════════════════════════


class TestGridNormalizeBounds:
    def test_normalize_swaps_when_reversed(self):
        grid = UniversalGrid(GridConfig(cell_px=24, margin_cols=2, cols=40, rows=30))
        start = CellCoord(col=8, row=10)
        end = CellCoord(col=3, row=5)
        bounds = grid.normalize_bounds(start, end)
        assert bounds.min_col == 3
        assert bounds.max_col == 8
        assert bounds.min_row == 5
        assert bounds.max_row == 10

    def test_normalize_identity_when_already_ordered(self):
        grid = UniversalGrid(GridConfig(cell_px=24, margin_cols=0, cols=10, rows=10))
        start = CellCoord(col=2, row=3)
        end = CellCoord(col=5, row=7)
        bounds = grid.normalize_bounds(start, end)
        assert bounds.min_col == 2
        assert bounds.max_col == 5

    def test_block_size_and_cell_count(self):
        grid = UniversalGrid(GridConfig(cell_px=24, margin_cols=0, cols=10, rows=10))
        bounds = BlockBounds(min_col=1, max_col=3, min_row=2, max_row=4)
        w, h = grid.block_size(bounds)
        assert w == 3
        assert h == 3
        assert grid.cell_count(bounds) == 9

    def test_board_capacity(self):
        grid = UniversalGrid(GridConfig(cell_px=24, margin_cols=2, cols=40, rows=30))
        cap = grid.board_capacity()
        assert cap == (40 - 2) * 30


# ═══════════════════════════════════════════════════════════════════════════
# manifest.py — head_revision + counter accessors
# ═══════════════════════════════════════════════════════════════════════════


class TestManifestBranches:
    def test_head_revision_found(self):
        m = create_default_manifest()
        rev = m.head_revision()
        assert rev is not None
        assert rev.revision_id == m.current_revision_id

    def test_head_revision_returns_none_when_no_current(self):
        m = create_default_manifest()
        m.current_revision_id = None
        assert m.head_revision() is None

    def test_head_revision_returns_none_when_id_not_found(self):
        m = create_default_manifest()
        m.current_revision_id = 'rev-nonexistent'
        assert m.head_revision() is None

    def test_get_next_revision_number(self):
        m = create_default_manifest()
        assert m.get_next_revision_number() == 1

    def test_get_next_event_sequence(self):
        m = create_default_manifest()
        assert m.get_next_event_sequence() == 1

    def test_snapshot_hash_is_deterministic(self):
        m = create_default_manifest()
        h1 = m.snapshot_hash()
        h2 = m.snapshot_hash()
        assert h1 == h2
        assert len(h1) == 64


# ═══════════════════════════════════════════════════════════════════════════
# service.py — derive_metrics edge cases
# ═══════════════════════════════════════════════════════════════════════════


class TestDeriveMetricsEdge:
    def test_metrics_with_zero_blocks(self, tmp_path: Path):
        svc = make_notebook_service(tmp_path)
        metrics = svc.derive_metrics()
        assert metrics.density == 0.0
        assert metrics.block_count == 0
        assert metrics.cluster_spread == 0.0
        assert metrics.margin_adherence == 0.0

    def test_metrics_with_single_block(self, tmp_path: Path):
        svc = make_notebook_service(tmp_path)
        svc.create_block(
            BlockCreate(min_col=2, max_col=4, min_row=1, max_row=3),
        )
        metrics = svc.derive_metrics()
        assert metrics.block_count == 1
        assert metrics.density > 0.0
        assert metrics.cluster_spread == 0.0
        assert metrics.margin_adherence == 1.0

    def test_metrics_with_multiple_blocks_has_spread(self, tmp_path: Path):
        svc = make_notebook_service(tmp_path)
        svc.create_block(BlockCreate(min_col=2, max_col=4, min_row=1, max_row=2))
        svc.create_block(BlockCreate(min_col=20, max_col=25, min_row=15, max_row=20))
        metrics = svc.derive_metrics()
        assert metrics.block_count == 2
        assert metrics.cluster_spread > 0.0
        assert metrics.block_dispersion > 0.0


# ═══════════════════════════════════════════════════════════════════════════
# service.py — render_heatmap_html
# ═══════════════════════════════════════════════════════════════════════════


class TestRenderHeatmapHtml:
    def test_heatmap_empty_board(self, tmp_path: Path):
        svc = make_notebook_service(tmp_path)
        html = svc.render_heatmap_html()
        assert 'LO7 Heatmap' in html
        assert '0 blocks' in html
        assert '0.00%' in html

    def test_heatmap_with_blocks(self, tmp_path: Path):
        svc = make_notebook_service(tmp_path)
        svc.create_block(BlockCreate(min_col=2, max_col=4, min_row=1, max_row=2, label='Heat', tone='amber'))
        html = svc.render_heatmap_html()
        assert 'Heat' in html
        assert 'amber' in html
        assert '1 blocks' in html


# ═══════════════════════════════════════════════════════════════════════════
# service.py — latest_bridge_payload (no emit yet, missing file)
# ═══════════════════════════════════════════════════════════════════════════


class TestLatestBridgePayload:
    def test_returns_none_when_no_payload(self, tmp_path: Path):
        svc = make_notebook_service(tmp_path)
        assert svc.latest_bridge_payload() is None

    def test_returns_missing_when_file_deleted(self, tmp_path: Path):
        svc = make_notebook_service(tmp_path)
        svc.emit_bridge_payload()
        result = svc.latest_bridge_payload()
        assert result is not None
        assert 'payload' in result

        artifact_path = Path(result['artifact']['path'])
        artifact_path.unlink()
        stale = svc.latest_bridge_payload()
        assert stale['missing'] is True


# ═══════════════════════════════════════════════════════════════════════════
# service.py — compact() dry-run + execute
# ═══════════════════════════════════════════════════════════════════════════


class TestCompaction:
    def _build_heavy_service(self, tmp_path: Path, n_blocks: int = 12):
        svc = make_notebook_service(tmp_path, max_inline_history=500)
        manifest = svc.get_manifest()
        manifest.max_revisions = 5
        svc.replace_manifest(manifest, expected_revision_id=None, actor='test')
        for i in range(n_blocks):
            svc.create_block(
                BlockCreate(min_col=2, max_col=4, min_row=i, max_row=i + 1, label=f"B{i}", tone='amber'),
            )
        return svc

    def test_compact_dry_run_reports_excess(self, tmp_path: Path):
        svc = self._build_heavy_service(tmp_path)
        result = svc.compact(dry_run=True)
        assert result['counts']['pruned_revisions'] > 0

    def test_compact_execute_archives_and_trims(self, tmp_path: Path):
        svc = self._build_heavy_service(tmp_path)
        result = svc.compact(dry_run=False)
        assert result['dry_run'] is False
        assert result['pruned_revisions'] > 0
        archive_path = Path(result['archive_path'])
        assert archive_path.exists()
        manifest = svc.get_manifest()
        assert len(manifest.revisions) <= 5

    def test_compact_noop_when_under_limit(self, tmp_path: Path):
        svc = make_notebook_service(tmp_path)
        result = svc.compact(dry_run=False)
        assert result['message'] == 'No compaction needed'


# ═══════════════════════════════════════════════════════════════════════════
# service.py — export_markdown
# ═══════════════════════════════════════════════════════════════════════════


class TestExportMarkdown:
    def test_empty_export(self, tmp_path: Path):
        svc = make_notebook_service(tmp_path)
        md = svc.export_markdown()
        assert '# LO7 Notebook Export' in md
        assert 'Notebook:' in md

    def test_export_with_blocks(self, tmp_path: Path):
        svc = make_notebook_service(tmp_path)
        svc.create_block(BlockCreate(min_col=2, max_col=5, min_row=0, max_row=2, label='Sprint', tone='mint'))
        md = svc.export_markdown()
        assert 'Sprint' in md
        assert 'mint' in md
        assert '| ' in md


# ═══════════════════════════════════════════════════════════════════════════
# craft.py — CommandCraftRenderer preflight edge case
# ═══════════════════════════════════════════════════════════════════════════


class TestCraftPreflightEdge:
    def test_command_with_only_whitespace(self):
        renderer = CommandCraftRenderer(command='   ')
        pf = renderer.preflight()
        assert pf.ready is False

    def test_command_existing_path(self, tmp_path: Path):
        script = tmp_path / 'fake-craft.sh'
        script.write_text('#!/bin/sh\necho ok', encoding='utf-8')
        script.chmod(0o755)
        renderer = CommandCraftRenderer(command=str(script))
        pf = renderer.preflight()
        assert pf.ready is True
        assert str(script) in pf.detail
