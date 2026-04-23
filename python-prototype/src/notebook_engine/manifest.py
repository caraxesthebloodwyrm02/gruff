from __future__ import annotations

from datetime import UTC, datetime
from hashlib import sha256
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field

from notebook_engine.blocks import Block
from notebook_engine.grid import GridConfig

SchemaVersion = Literal['notebook-manifest-v1']


def utc_now() -> str:
    return datetime.now(tz=UTC).isoformat()


class ArtifactRef(BaseModel):
    model_config = ConfigDict(extra='forbid')

    artifact_type: str
    path: str
    created_at: str = Field(default_factory=utc_now)
    profile: str = 'default'
    metadata: dict[str, Any] = Field(default_factory=dict)


class NotebookEvent(BaseModel):
    model_config = ConfigDict(extra='forbid')

    event_id: str
    revision_id: str
    timestamp: str = Field(default_factory=utc_now)
    actor: str = 'system'
    kind: str
    summary: str
    data: dict[str, Any] = Field(default_factory=dict)


class NotebookRevision(BaseModel):
    model_config = ConfigDict(extra='forbid')

    revision_id: str
    number: int = Field(ge=0)
    parent_revision_id: str | None = None
    created_at: str = Field(default_factory=utc_now)
    actor: str = 'system'
    summary: str
    event_id: str
    snapshot_hash: str


class CompassMetrics(BaseModel):
    model_config = ConfigDict(extra='forbid')

    density: float = 0.0
    tone_distribution: dict[str, float] = Field(default_factory=dict)
    cluster_spread: float = 0.0
    margin_adherence: float = 1.0
    gesture_velocity_proxy: float = 0.0
    revision_churn: float = 0.0
    block_dispersion: float = 0.0
    block_count: int = 0
    block_area_total: int = 0


class CompassState(BaseModel):
    model_config = ConfigDict(extra='forbid')

    renderer: str | None = None
    last_profile: str | None = None
    last_rendered_at: str | None = None
    last_error: str | None = None
    last_metrics: CompassMetrics | None = None
    last_artifacts: list[ArtifactRef] = Field(default_factory=list)


class IntegrationMetadata(BaseModel):
    model_config = ConfigDict(extra='forbid')

    compass: CompassState = Field(default_factory=CompassState)
    heatmap_artifacts: list[ArtifactRef] = Field(default_factory=list)
    bridge_payload_ref: ArtifactRef | None = None
    validation_warnings: list[str] = Field(default_factory=list)


class NotebookManifest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    schema_version: SchemaVersion = 'notebook-manifest-v1'
    notebook_id: str = Field(default_factory=lambda: f'lo7-{uuid4().hex[:10]}')
    board_title: str = 'LO7 Notebook'
    created_at: str = Field(default_factory=utc_now)
    updated_at: str = Field(default_factory=utc_now)
    grid: GridConfig = Field(default_factory=GridConfig)
    blocks: list[Block] = Field(default_factory=list)
    revisions: list[NotebookRevision] = Field(default_factory=list)
    events: list[NotebookEvent] = Field(default_factory=list)
    current_revision_id: str | None = None
    integration: IntegrationMetadata = Field(default_factory=IntegrationMetadata)

    def head_revision(self) -> NotebookRevision | None:
        if not self.current_revision_id:
            return None
        for revision in reversed(self.revisions):
            if revision.revision_id == self.current_revision_id:
                return revision
        return None

    def snapshot_hash(self) -> str:
        payload = self.model_dump(
            mode='json',
            exclude={'events', 'revisions', 'current_revision_id', 'created_at', 'updated_at'},
        )
        encoded = str(payload).encode('utf-8')
        return sha256(encoded).hexdigest()


def create_default_manifest(*, grid: GridConfig | None = None, notebook_id: str | None = None) -> NotebookManifest:
    manifest = NotebookManifest(grid=grid or GridConfig(), notebook_id=notebook_id or f'lo7-{uuid4().hex[:10]}')
    bootstrap_event = NotebookEvent(
        event_id='evt-bootstrap',
        revision_id='rev-bootstrap',
        actor='system',
        kind='manifest.bootstrap',
        summary='Initialized manifest',
    )
    bootstrap_revision = NotebookRevision(
        revision_id='rev-bootstrap',
        number=0,
        actor='system',
        summary='Initialized manifest',
        event_id=bootstrap_event.event_id,
        snapshot_hash=manifest.snapshot_hash(),
    )
    manifest.events.append(bootstrap_event)
    manifest.revisions.append(bootstrap_revision)
    manifest.current_revision_id = bootstrap_revision.revision_id
    manifest.updated_at = utc_now()
    return manifest
