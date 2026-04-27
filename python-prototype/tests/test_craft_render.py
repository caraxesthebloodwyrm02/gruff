"""Tests for craft.py render path + CraftRenderResult artifact conversion.

Covers:
- FakeCraftRenderer.render() happy path → CraftRenderResult
- FakeCraftRenderer.render() forced failure for specific profiles
- CraftRenderResult.to_artifact() → ArtifactRef conversion
- CommandCraftRenderer.preflight() when command is empty / missing
- CommandCraftRenderer.preflight() when command binary not found
- CommandCraftRenderer.render() raises when preflight fails
- service.render_compass() integration via FakeCraftRenderer
- service.compass_status() after render
- service.build_bridge_payload() after render
"""

from __future__ import annotations

from pathlib import Path

import pytest

from notebook_engine.craft import CommandCraftRenderer, CraftPreflight, CraftRenderResult
from notebook_engine.manifest import ArtifactRef, CompassMetrics, create_default_manifest
from notebook_engine.test_doubles import FakeCraftRenderer, make_notebook_service


# ── CraftRenderResult.to_artifact() ────────────────────────────────────────

class TestCraftRenderResult:
    def test_to_artifact_returns_artifact_ref(self):
        result = CraftRenderResult(
            renderer='craft-server',
            profile='diagnostic',
            artifact_path='/tmp/render.png',
            metadata={'fake': True},
        )
        artifact = result.to_artifact()
        assert isinstance(artifact, ArtifactRef)
        assert artifact.artifact_type == 'compass-render'
        assert artifact.path == '/tmp/render.png'
        assert artifact.profile == 'diagnostic'
        assert artifact.metadata['fake'] is True

    def test_to_artifact_has_created_at_timestamp(self):
        result = CraftRenderResult(renderer='x', profile='default', artifact_path='/x.png')
        artifact = result.to_artifact()
        assert artifact.created_at  # non-empty ISO timestamp


# ── FakeCraftRenderer ───────────────────────────────────────────────────────

class TestFakeCraftRenderer:
    def test_preflight_always_ready(self, tmp_path: Path):
        renderer = FakeCraftRenderer(tmp_path)
        pf = renderer.preflight()
        assert pf.ready is True
        assert pf.renderer == 'craft-server'

    def test_render_happy_path(self, tmp_path: Path):
        renderer = FakeCraftRenderer(tmp_path)
        manifest = create_default_manifest()
        metrics = CompassMetrics(density=0.5, block_count=3, block_area_total=72)
        result = renderer.render(
            manifest=manifest, metrics=metrics, profile='diagnostic', output_dir=tmp_path / 'out'
        )
        assert result.renderer == 'craft-server'
        assert result.profile == 'diagnostic'
        assert Path(result.artifact_path).exists()
        assert 'fake-render' in Path(result.artifact_path).read_text()

    def test_render_failure_for_blocked_profile(self, tmp_path: Path):
        renderer = FakeCraftRenderer(tmp_path, fail_profiles=frozenset({'broken'}))
        manifest = create_default_manifest()
        metrics = CompassMetrics()
        with pytest.raises(RuntimeError, match='forced craft failure'):
            renderer.render(manifest=manifest, metrics=metrics, profile='broken', output_dir=tmp_path / 'out')

    def test_render_creates_output_directory(self, tmp_path: Path):
        renderer = FakeCraftRenderer(tmp_path)
        manifest = create_default_manifest()
        metrics = CompassMetrics()
        out_dir = tmp_path / 'nested' / 'artifacts'
        renderer.render(manifest=manifest, metrics=metrics, profile='default', output_dir=out_dir)
        assert out_dir.exists()


# ── CommandCraftRenderer.preflight() ────────────────────────────────────────

class TestCommandCraftRendererPreflight:
    def test_empty_command_not_ready(self):
        renderer = CommandCraftRenderer(command=None)
        pf = renderer.preflight()
        assert pf.ready is False
        assert 'not configured' in pf.detail

    def test_blank_string_not_ready(self):
        renderer = CommandCraftRenderer(command='   ')
        pf = renderer.preflight()
        assert pf.ready is False

    def test_nonexistent_binary_not_ready(self):
        renderer = CommandCraftRenderer(command='/usr/bin/__nonexistent_gruff_compass_x_test__')
        pf = renderer.preflight()
        assert pf.ready is False
        assert 'not found' in pf.detail

    def test_existing_binary_is_ready(self):
        renderer = CommandCraftRenderer(command='/usr/bin/echo')
        pf = renderer.preflight()
        assert pf.ready is True
        assert 'Configured' in pf.detail

    def test_render_raises_when_not_ready(self):
        renderer = CommandCraftRenderer(command=None)
        manifest = create_default_manifest()
        metrics = CompassMetrics()
        with pytest.raises(RuntimeError, match='not configured'):
            renderer.render(
                manifest=manifest, metrics=metrics, profile='default', output_dir=Path('/tmp/test-out')
            )


# ── Service integration: render_compass + compass_status + bridge ───────────

class TestServiceCompassIntegration:
    @pytest.fixture()
    def service(self, tmp_path: Path):
        return make_notebook_service(tmp_path)

    def test_render_compass_returns_profile_and_artifact(self, service):
        result = service.render_compass(profile='diagnostic')
        assert result['profile'] == 'diagnostic'
        assert result['renderer'] == 'craft-server'
        assert 'artifact' in result
        assert result['artifact']['artifact_type'] == 'compass-render'

    def test_render_compass_persists_metrics(self, service):
        service.render_compass(profile='default')
        status = service.compass_status()
        assert status['renderer'] == 'craft-server'
        assert status['last_profile'] == 'default'
        assert status['last_rendered_at'] is not None
        assert status['last_metrics'] is not None
        assert status['last_error'] is None

    def test_compass_status_before_render_is_empty(self, service):
        status = service.compass_status()
        assert status['renderer'] is None
        assert status['last_profile'] is None

    def test_build_bridge_payload_after_render(self, service):
        service.render_compass(profile='bridge')
        payload = service.build_bridge_payload()
        assert payload.schemaVersion == 'gruff-proportion-v1'
        assert 0.0 <= payload.audioDrive <= 1.0
        assert 0.0 <= payload.theta <= 1.0
        assert payload.compass['artifact'] is not None

    def test_build_bridge_payload_without_render_uses_derived(self, service):
        payload = service.build_bridge_payload()
        assert payload.schemaVersion == 'gruff-proportion-v1'
        assert payload.compass['artifact'] is None

    def test_emit_bridge_payload_persists_to_disk(self, service):
        result = service.emit_bridge_payload()
        assert 'payload' in result
        assert 'artifact' in result
        artifact_path = Path(result['artifact']['path'])
        assert artifact_path.exists()
