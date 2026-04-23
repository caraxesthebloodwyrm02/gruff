from __future__ import annotations

import json
import shlex
import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from notebook_engine.manifest import ArtifactRef, CompassMetrics, NotebookManifest


@dataclass
class CraftPreflight:
    ready: bool
    renderer: str
    detail: str


@dataclass
class CraftRenderResult:
    renderer: str
    profile: str
    artifact_path: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_artifact(self) -> ArtifactRef:
        return ArtifactRef(
            artifact_type='compass-render',
            path=self.artifact_path,
            profile=self.profile,
            metadata=self.metadata,
        )


class CraftRenderer(Protocol):
    def preflight(self) -> CraftPreflight:
        ...

    def render(self, *, manifest: NotebookManifest, metrics: CompassMetrics, profile: str, output_dir: Path) -> CraftRenderResult:
        ...


class CommandCraftRenderer:
    """Required external renderer contract for craft-server integration."""

    def __init__(self, command: str | None):
        self.command = command.strip() if command else ''

    def preflight(self) -> CraftPreflight:
        if not self.command:
            return CraftPreflight(False, 'craft-server', 'LO7_CRAFT_RENDER_COMMAND is not configured')
        argv = shlex.split(self.command)
        if not argv:
            return CraftPreflight(False, 'craft-server', 'LO7_CRAFT_RENDER_COMMAND is empty')

        executable = argv[0]
        resolved = shutil.which(executable) if not Path(executable).exists() else executable
        if not resolved:
            return CraftPreflight(False, 'craft-server', f'Render command not found: {executable}')

        return CraftPreflight(True, 'craft-server', f'Configured renderer command: {self.command}')

    def render(self, *, manifest: NotebookManifest, metrics: CompassMetrics, profile: str, output_dir: Path) -> CraftRenderResult:
        preflight = self.preflight()
        if not preflight.ready:
            raise RuntimeError(preflight.detail)

        output_dir.mkdir(parents=True, exist_ok=True)
        request_payload = {
            'tool': 'render_module',
            'module': 'gruff_compass_x',
            'profile': profile,
            'manifest': manifest.model_dump(mode='json'),
            'metrics': metrics.model_dump(mode='json'),
        }

        with tempfile.TemporaryDirectory(prefix='lo7-craft-') as tmp_dir:
            tmp_path = Path(tmp_dir)
            input_path = tmp_path / 'request.json'
            output_path = tmp_path / 'response.json'
            input_path.write_text(json.dumps(request_payload, indent=2), encoding='utf-8')

            argv = shlex.split(self.command) + [str(input_path), str(output_path), profile, 'gruff_compass_x']
            completed = subprocess.run(argv, capture_output=True, text=True)
            if completed.returncode != 0:
                stderr = completed.stderr.strip() or completed.stdout.strip() or 'unknown craft renderer error'
                raise RuntimeError(stderr)

            if not output_path.exists():
                raise RuntimeError('Craft renderer did not produce a response payload')

            response = json.loads(output_path.read_text(encoding='utf-8'))

        artifact_path = Path(response['artifact_path'])
        if not artifact_path.is_absolute():
            artifact_path = (output_dir / artifact_path).resolve()

        return CraftRenderResult(
            renderer='craft-server',
            profile=profile,
            artifact_path=str(artifact_path),
            metadata=response.get('metadata', {}),
        )
