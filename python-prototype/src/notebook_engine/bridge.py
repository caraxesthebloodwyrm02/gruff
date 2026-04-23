from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from notebook_engine.manifest import ArtifactRef, CompassMetrics, NotebookManifest


def utc_now() -> str:
    return datetime.now(tz=UTC).isoformat()


class GruffWeights(BaseModel):
    model_config = ConfigDict(extra='forbid')

    sound: float = Field(ge=0.0, le=1.0)
    gesture: float = Field(ge=0.0, le=1.0)
    calculation: float = Field(ge=0.0, le=1.0)


class GruffSequence(BaseModel):
    model_config = ConfigDict(extra='forbid')

    stepName: str
    stepIndex: int = Field(ge=0)


class GruffCompassPayload(BaseModel):
    model_config = ConfigDict(extra='forbid')

    schemaVersion: str = 'gruff-proportion-v1'
    generatedAt: str = Field(default_factory=utc_now)
    audioDrive: float = Field(ge=0.0, le=1.0)
    theta: float = Field(ge=0.0, le=1.0)
    weights: GruffWeights
    sequence: GruffSequence
    manifest: dict[str, Any]
    compass: dict[str, Any]
    provenance: dict[str, Any]


def build_gruff_payload(
    *,
    manifest: NotebookManifest,
    metrics: CompassMetrics,
    render_artifact: ArtifactRef | None,
) -> GruffCompassPayload:
    tone_distribution = metrics.tone_distribution
    tone_signal = max(tone_distribution.values()) if tone_distribution else 0.0
    audio_drive = min(1.0, round((metrics.density * 0.45) + (metrics.gesture_velocity_proxy * 0.35) + (tone_signal * 0.20), 4))
    theta = min(1.0, round((metrics.margin_adherence * 0.40) + (metrics.cluster_spread * 0.30) + (metrics.block_dispersion * 0.30), 4))
    return GruffCompassPayload(
        audioDrive=audio_drive,
        theta=theta,
        weights=GruffWeights(sound=metrics.density, gesture=metrics.gesture_velocity_proxy, calculation=metrics.margin_adherence),
        sequence=GruffSequence(stepName='lo7-compass-render', stepIndex=len(manifest.revisions)),
        manifest={
            'notebookId': manifest.notebook_id,
            'revisionId': manifest.current_revision_id,
            'blockCount': len(manifest.blocks),
        },
        compass={
            'metrics': metrics.model_dump(mode='json'),
            'artifact': render_artifact.model_dump(mode='json') if render_artifact else None,
        },
        provenance={
            'boardTitle': manifest.board_title,
            'schemaVersion': manifest.schema_version,
            'renderedAt': utc_now(),
        },
    )


def persist_payload(payload: GruffCompassPayload, *, output_dir: Path) -> ArtifactRef:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_path = output_dir / f'{payload.manifest["notebookId"]}-bridge.json'
    output_path.write_text(json.dumps(payload.model_dump(mode='json'), indent=2), encoding='utf-8')
    return ArtifactRef(
        artifact_type='gruff-bridge-payload',
        path=str(output_path),
        profile='bridge',
        metadata={'schemaVersion': payload.schemaVersion},
    )
