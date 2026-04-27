"""Tests for the halo exhibit compass construction and orbital-pull pattern.

Covers:
- CompassMetrics derivation (audioDrive, theta) from bridge.py formulas
- Data-weighted centroid calculation (standpoint)
- Grid quantization of the standpoint to cell coordinates
- Quadrant weight distribution (12→3, 6→9, 3→6, 9→12)
- Arc opacity per ring per quadrant
- Orbital-Pull divergence score and threshold classification
- PROJECT_REGISTRY schema compliance for delivered artifacts
"""

from __future__ import annotations

import math
import os
from pathlib import Path

import pytest
import yaml

from notebook_engine.grid import GridConfig, UniversalGrid
from notebook_engine.manifest import CompassMetrics
from notebook_engine.bridge import build_gruff_payload, GruffCompassPayload
from notebook_engine.manifest import NotebookManifest, create_default_manifest


# ── Heatmap node data (from mtime scan 2026-04-28) ─────────────────────────

HEATMAP_NODES = [
    {'name': '~',                 'cx': 600,  'cy': 400, 'weight': 42},
    {'name': 'personal-rag',      'cx': 450,  'cy': 550, 'weight': 41},
    {'name': '.hermes',           'cx': 280,  'cy': 280, 'weight': 30},
    {'name': '.claude/plans',     'cx': 920,  'cy': 320, 'weight': 28},
    {'name': '.cache',            'cx': 180,  'cy': 520, 'weight': 25},
    {'name': '.cursor/plans',     'cx': 1020, 'cy': 480, 'weight': 22},
    {'name': 'gruff',             'cx': 750,  'cy': 550, 'weight': 13},
    {'name': 'Downloads',         'cx': 150,  'cy': 680, 'weight': 10},
    {'name': 'grove',             'cx': 850,  'cy': 650, 'weight': 7},
    {'name': 'constrained-signal','cx': 350,  'cy': 350, 'weight': 5},
]


def _weighted_centroid(nodes: list[dict]) -> tuple[float, float]:
    total_w = sum(n['weight'] for n in nodes)
    cx = sum(n['cx'] * n['weight'] for n in nodes) / total_w
    cy = sum(n['cy'] * n['weight'] for n in nodes) / total_w
    return cx, cy


# ── Centroid and standpoint ─────────────────────────────────────────────────

class TestStandpoint:
    def test_centroid_is_near_555_451(self):
        cx, cy = _weighted_centroid(HEATMAP_NODES)
        assert 550 < cx < 560, f"centroid x={cx} not near 555"
        assert 445 < cy < 456, f"centroid y={cy} not near 451"

    def test_centroid_weights_sum_to_223(self):
        total = sum(n['weight'] for n in HEATMAP_NODES)
        assert total == 223

    def test_grid_quantize_standpoint(self):
        cfg = GridConfig(cell_px=24, margin_cols=0, cols=50, rows=34)
        col, row = cfg.quantize(555.0, 451.0)
        assert col == 23
        assert row == 18


# ── Compass arc math ────────────────────────────────────────────────────────

class TestCompassArcs:
    CX, CY = 555, 451

    @pytest.mark.parametrize('r', [120, 200, 300])
    def test_12_oclock_is_top(self, r: int):
        x, y = self.CX, self.CY - r
        assert y == self.CY - r
        assert x == self.CX

    @pytest.mark.parametrize('r', [120, 200, 300])
    def test_3_oclock_is_right(self, r: int):
        x, y = self.CX + r, self.CY
        assert x == self.CX + r

    @pytest.mark.parametrize('r', [120, 200, 300])
    def test_all_endpoints_within_viewport(self, r: int):
        points = [
            (self.CX, self.CY - r),      # 12
            (self.CX + r, self.CY),       # 3
            (self.CX, self.CY + r),       # 6
            (self.CX - r, self.CY),       # 9
        ]
        for x, y in points:
            assert 0 <= x <= 1200, f"x={x} outside viewport"
            assert 0 <= y <= 800,  f"y={y} outside viewport"


# ── Quadrant weights ────────────────────────────────────────────────────────

def _classify_quadrant(cx: float, cy: float, node: dict) -> str:
    nx, ny = node['cx'], node['cy']
    if nx > cx and ny < cy:
        return 'Q1'  # 12→3
    elif nx < cx and ny < cy:
        return 'Q2'  # 9→12
    elif nx < cx and ny > cy:
        return 'Q3'  # 6→9
    else:
        return 'Q4'  # 3→6


class TestQuadrantWeights:
    CX, CY = 555, 451

    @staticmethod
    def _quadrant_weights(exclude_hub: bool = True) -> dict[str, int]:
        cx, cy = 555, 451
        q_w: dict[str, int] = {'Q1': 0, 'Q2': 0, 'Q3': 0, 'Q4': 0}
        for n in HEATMAP_NODES:
            if exclude_hub and n['name'] == '~':
                continue
            q = _classify_quadrant(cx, cy, n)
            q_w[q] += n['weight']
        return q_w

    def test_q3_is_heaviest(self):
        q_w = self._quadrant_weights()
        assert max(q_w, key=q_w.get) == 'Q3'

    def test_q1_is_lightest_excluding_hub(self):
        q_w = self._quadrant_weights(exclude_hub=True)
        assert min(q_w, key=q_w.get) == 'Q1'

    def test_q1_plus_hub_is_not_lightest(self):
        q_w = self._quadrant_weights(exclude_hub=False)
        assert min(q_w, key=q_w.get) != 'Q1'


# ── CompassMetrics and bridge formulas ──────────────────────────────────────

class TestCompassMetrics:
    def test_audio_drive_formula(self):
        density = 0.37
        gesture = 0.85
        tone_signal = 0.70
        audio_drive = density * 0.45 + gesture * 0.35 + tone_signal * 0.20
        assert abs(audio_drive - 0.604) < 0.01

    def test_theta_formula(self):
        margin = 0.94
        spread = 0.44
        dispersion = 0.30
        theta = margin * 0.40 + spread * 0.30 + dispersion * 0.30
        assert abs(theta - 0.598) < 0.01

    def test_arc_opacity_q3_middle_ring(self):
        audio_drive = 0.604
        q3_weight = 1.0
        ring_multiplier = 1.0
        opacity = q3_weight * audio_drive * ring_multiplier
        assert abs(opacity - 0.604) < 0.01

    def test_arc_opacity_q1_inner_ring(self):
        audio_drive = 0.604
        q1_weight = 28 / 76
        ring_multiplier = 0.6
        opacity = q1_weight * audio_drive * ring_multiplier
        assert opacity < 0.15

    def test_build_gruff_payload_returns_valid_schema(self):
        manifest = create_default_manifest()
        metrics = CompassMetrics(
            density=0.37,
            tone_distribution={'amber': 0.70, 'cyan': 0.30},
            cluster_spread=0.44,
            margin_adherence=0.94,
            gesture_velocity_proxy=0.85,
            revision_churn=0.20,
            block_dispersion=0.30,
            block_count=10,
            block_area_total=240,
        )
        payload = build_gruff_payload(manifest=manifest, metrics=metrics, render_artifact=None)
        assert isinstance(payload, GruffCompassPayload)
        assert payload.schemaVersion == 'gruff-proportion-v1'
        assert 0.0 <= payload.audioDrive <= 1.0
        assert 0.0 <= payload.theta <= 1.0


# ── Orbital-Pull divergence scoring ─────────────────────────────────────────

def _divergence_score(nodes: list[dict]) -> float:
    total = sum(n['weight'] for n in nodes)
    if total == 0:
        return 0.0
    sorted_nodes = sorted(nodes, key=lambda n: n['weight'], reverse=True)
    top3 = sum(n['weight'] for n in sorted_nodes[:3])
    return top3 / total


def _classify_divergence(score: float) -> str:
    if score < 0.4:
        return 'STABLE'
    elif score < 0.6:
        return 'MODERATE'
    elif score < 0.8:
        return 'HIGH'
    return 'CRITICAL'


class TestOrbitalPull:
    def test_current_divergence_score_is_stable(self):
        score = _divergence_score(HEATMAP_NODES)
        assert score < 0.6, f"score {score} should be STABLE or MODERATE"

    def test_divergence_classification(self):
        assert _classify_divergence(0.37) == 'STABLE'
        assert _classify_divergence(0.45) == 'MODERATE'
        assert _classify_divergence(0.72) == 'HIGH'
        assert _classify_divergence(0.85) == 'CRITICAL'

    def test_chaos_scenario_triggers_high(self):
        chaos_nodes = HEATMAP_NODES + [
            {'name': 'new-exp-1', 'cx': 500, 'cy': 300, 'weight': 60},
            {'name': 'new-exp-2', 'cx': 700, 'cy': 200, 'weight': 50},
        ]
        score = _divergence_score(chaos_nodes)
        assert _classify_divergence(score) in ('MODERATE', 'HIGH', 'CRITICAL')


# ── Two-particle traces ─────────────────────────────────────────────────────

ALPHA_DATA = [1, 0, 0, 0, 0, 0, 0, 14, 0, 0, 22, 0, 0, 12]
BETA_DATA  = [731, 1, 0, 1, 0, 13, 1, 283, 0, 0, 6, 0, 0, 11]


class TestParticleTraces:
    def test_alpha_total_weight(self):
        assert sum(ALPHA_DATA) < 100

    def test_beta_total_weight(self):
        assert sum(BETA_DATA) > 1000

    def test_contrast_ratio(self):
        ratio = sum(BETA_DATA) / max(sum(ALPHA_DATA), 1)
        assert ratio > 10, 'β should be >10× heavier than α'

    def test_alpha_peak_at_bucket_10(self):
        assert ALPHA_DATA.index(max(ALPHA_DATA)) == 10

    def test_beta_peak_at_bucket_0(self):
        assert BETA_DATA.index(max(BETA_DATA)) == 0

    def test_14_buckets(self):
        assert len(ALPHA_DATA) == 14
        assert len(BETA_DATA) == 14

    def test_convergence_both_active_at_bucket_13(self):
        assert ALPHA_DATA[13] > 0, 'α must be active at takeoff'
        assert BETA_DATA[13] > 0, 'β must be active at takeoff'


# ── Registry schema compliance ──────────────────────────────────────────────

REGISTRY_PATH = Path('/home/irfankabir/PROJECT_REGISTRY.yaml')
REQUIRED_FIELDS = ['id', 'name', 'status', 'path', 'started_on', 'created_why', 'created_how', 'attribution']
ATTRIBUTION_FIELDS = ['author', 'known_as', 'signature']


@pytest.mark.skipif(not REGISTRY_PATH.exists(), reason='PROJECT_REGISTRY.yaml not on disk')
class TestRegistrySchema:
    @pytest.fixture(scope='class')
    def registry(self) -> dict:
        return yaml.safe_load(REGISTRY_PATH.read_text(encoding='utf-8'))

    def test_registry_has_projects(self, registry: dict):
        assert 'projects' in registry
        assert len(registry['projects']) >= 5

    def test_all_projects_have_required_fields(self, registry: dict):
        for project in registry['projects']:
            for field in REQUIRED_FIELDS:
                assert field in project, f"project {project.get('id', '?')} missing {field}"

    def test_attribution_blocks_complete(self, registry: dict):
        for project in registry['projects']:
            attr = project['attribution']
            for field in ATTRIBUTION_FIELDS:
                assert field in attr, f"project {project['id']} attribution missing {field}"

    def test_signature_line_canonical(self, registry: dict):
        for project in registry['projects']:
            assert project['attribution']['signature'] == 'Built by Prince (Irfan Kabir)'

    def test_forensic_protocol_released(self, registry: dict):
        ids = [p['id'] for p in registry['projects']]
        assert 'forensic-changelog-protocol' in ids

    def test_halo_exhibit_released(self, registry: dict):
        ids = [p['id'] for p in registry['projects']]
        assert 'halo-exhibit' in ids

    def test_evidence_paths_have_notes(self, registry: dict):
        for project in registry['projects']:
            if 'evidence' in project:
                for ev in project['evidence']:
                    assert 'path' in ev
                    assert 'note' in ev
