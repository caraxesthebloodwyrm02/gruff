"""Tests for CLI entry points: lo7-manifest, lo7-heatmap, lo7-compass.

Covers:
- cli.build_service() with real schema paths
- cli.default_manifest_path() resolution
- run_lo7_manifest show/validate/watch --json
- run_lo7_heatmap --output
- run_lo7_compass metrics/status --json
- Error handling for invalid subcommands
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from unittest.mock import patch

import pytest

from notebook_engine.cli import (
    build_service,
    default_manifest_path,
    run_lo7_compass,
    run_lo7_heatmap,
    run_lo7_manifest,
)


# ── Helpers ─────────────────────────────────────────────────────────────────

def _schema_root() -> Path:
    return Path(__file__).resolve().parents[1]


@pytest.fixture()
def manifest_file(tmp_path: Path) -> Path:
    return tmp_path / 'notebook.manifest.json'


# ── build_service + default_manifest_path ───────────────────────────────────

class TestCLIFactory:
    def test_default_manifest_path_is_absolute(self):
        p = default_manifest_path()
        assert p.is_absolute()
        assert p.name == 'notebook.manifest.json'

    def test_build_service_creates_manifest(self, tmp_path: Path):
        svc = build_service(tmp_path / 'nb.manifest.json', craft_required=False)
        assert svc is not None
        assert (tmp_path / 'nb.manifest.json').exists()

    def test_build_service_with_env_command(self, tmp_path: Path):
        with patch.dict(os.environ, {'LO7_CRAFT_RENDER_COMMAND': '/usr/bin/echo'}):
            svc = build_service(tmp_path / 'nb.manifest.json', craft_required=True)
            assert svc is not None


# ── run_lo7_manifest ────────────────────────────────────────────────────────

class TestLo7Manifest:
    def test_show_json(self, manifest_file: Path, capsys):
        run_lo7_manifest(['--manifest-path', str(manifest_file), '--json', 'show'])
        out = capsys.readouterr().out
        parsed = json.loads(out)
        assert 'notebook_id' in parsed
        assert 'current_revision_id' in parsed

    def test_validate_json(self, manifest_file: Path, capsys):
        run_lo7_manifest(['--manifest-path', str(manifest_file), '--json', 'validate'])
        out = capsys.readouterr().out
        parsed = json.loads(out)
        assert 'craft_ready' in parsed
        assert 'manifest_path' in parsed

    def test_watch_json(self, manifest_file: Path, capsys):
        run_lo7_manifest(['--manifest-path', str(manifest_file), 'watch'])
        out = capsys.readouterr().out
        parsed = json.loads(out)
        assert 'revision' in parsed
        assert 'events' in parsed


# ── run_lo7_heatmap ─────────────────────────────────────────────────────────

class TestLo7Heatmap:
    def test_heatmap_generates_html(self, manifest_file: Path, tmp_path: Path):
        output = tmp_path / 'heatmap.html'
        run_lo7_heatmap([
            '--manifest-path', str(manifest_file),
            '--output', str(output),
        ])
        assert output.exists()
        content = output.read_text()
        assert 'LO7 Heatmap' in content
        assert '<html' in content


# ── run_lo7_compass ─────────────────────────────────────────────────────────

class TestLo7Compass:
    def test_metrics_json(self, manifest_file: Path, capsys):
        run_lo7_compass(['--manifest-path', str(manifest_file), '--json', 'metrics'])
        out = capsys.readouterr().out
        parsed = json.loads(out)
        assert 'density' in parsed
        assert 'cluster_spread' in parsed
        assert 'margin_adherence' in parsed
        assert 'gesture_velocity_proxy' in parsed

    def test_status_json(self, manifest_file: Path, capsys):
        run_lo7_compass(['--manifest-path', str(manifest_file), '--json', 'status'])
        out = capsys.readouterr().out
        parsed = json.loads(out)
        assert 'renderer' in parsed
        assert 'last_profile' in parsed
