from __future__ import annotations

from pathlib import Path

import httpx
import pytest

from notebook_engine.api import build_app
from notebook_engine.craft import CraftPreflight, CraftRenderResult
from notebook_engine.grid import GridConfig
from notebook_engine.service import NotebookService


class FakeCraftRenderer:
    def __init__(self, tmp_path: Path):
        self.tmp_path = tmp_path

    def preflight(self) -> CraftPreflight:
        return CraftPreflight(True, 'craft-server', 'fake renderer ready')

    def render(self, *, manifest, metrics, profile, output_dir):
        output_dir.mkdir(parents=True, exist_ok=True)
        artifact_path = output_dir / f'{manifest.notebook_id}-{profile}.png'
        artifact_path.write_text('fake-render', encoding='utf-8')
        return CraftRenderResult(
            renderer='craft-server',
            profile=profile,
            artifact_path=str(artifact_path),
            metadata={'fake': True, 'revision': manifest.current_revision_id},
        )


@pytest.fixture
def app(tmp_path: Path):
    root = Path(__file__).resolve().parents[2]
    service = NotebookService(
        manifest_path=tmp_path / 'notebook.manifest.json',
        grid_config=GridConfig(cell_px=24, margin_cols=2, cols=40, rows=30),
        craft_renderer=FakeCraftRenderer(tmp_path),
        schema_path=root / 'schemas' / 'trust-event-v1.schema.json',
        bridge_schema_path=root / 'schemas' / 'gruff-proportion-v1.schema.json',
        manifest_schema_path=root / 'schemas' / 'notebook-manifest-v1.schema.json',
        craft_required=True,
    )
    return build_app(service=service)


@pytest.fixture
async def client(app):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url='http://testserver') as async_client:
        yield async_client


@pytest.mark.anyio
async def test_health_and_manifest_endpoints(client: httpx.AsyncClient, app) -> None:
    health = await client.get('/api/health')
    assert health.status_code == 200
    assert health.json()['craftReady'] is True

    manifest = await client.get('/api/manifest')
    assert manifest.status_code == 200
    body = manifest.json()
    assert body['schema_version'] == 'notebook-manifest-v1'
    assert body['current_revision_id']
    assert any(getattr(route, 'path', None) == '/ws' for route in app.routes)


@pytest.mark.anyio
async def test_block_lifecycle_updates_manifest_and_revisions(client: httpx.AsyncClient) -> None:
    created = await client.post(
        '/api/blocks',
        json={
            'min_col': 2,
            'max_col': 4,
            'min_row': 1,
            'max_row': 3,
            'label': 'Daily Plan',
            'tone': 'mint',
        },
    )
    assert created.status_code == 201
    assert created.json()['label'] == 'Daily Plan'

    manifest = (await client.get('/api/manifest')).json()
    assert len(manifest['blocks']) == 1
    assert manifest['blocks'][0]['tone'] == 'mint'

    revisions = (await client.get('/api/revisions')).json()
    assert revisions[-1]['summary'].startswith('Created block')

    deleted = await client.delete(f"/api/blocks/{created.json()['id']}")
    assert deleted.status_code == 204
    assert (await client.get('/api/manifest')).json()['blocks'] == []


@pytest.mark.anyio
async def test_csv_import_dry_run_vs_commit(client: httpx.AsyncClient) -> None:
    csv_text = 'min_col,max_col,min_row,max_row,label,tone\n2,4,1,2,Imported block,azure\n'

    dry_run = await client.post('/api/exports/csv-import?dry_run=true', content=csv_text, headers={'content-type': 'text/plain'})
    assert dry_run.status_code == 200
    assert dry_run.json()['dry_run'] is True
    assert (await client.get('/api/manifest')).json()['blocks'] == []

    committed = await client.post('/api/exports/csv-import', content=csv_text, headers={'content-type': 'text/plain'})
    assert committed.status_code == 200
    assert committed.json()['dry_run'] is False
    assert len((await client.get('/api/manifest')).json()['blocks']) == 1


@pytest.mark.anyio
async def test_compass_render_and_bridge_emit(client: httpx.AsyncClient) -> None:
    await client.post('/api/blocks', json={'min_col': 2, 'max_col': 6, 'min_row': 2, 'max_row': 5, 'label': 'Compass lane', 'tone': 'amber'})

    rendered = await client.post('/api/compass/render?profile=diagnostic')
    assert rendered.status_code == 200
    payload = rendered.json()
    assert payload['renderer'] == 'craft-server'
    assert payload['artifact']['path'].endswith('.png')
    assert payload['metrics']['block_count'] == 1

    bridge = await client.post('/api/bridge/payload')
    assert bridge.status_code == 200
    bridge_payload = bridge.json()['payload']
    assert bridge_payload['schemaVersion'] == 'gruff-proportion-v1'
    assert bridge_payload['manifest']['blockCount'] == 1

    bridge_status = await client.get('/api/bridge/payload')
    assert bridge_status.status_code == 200
    assert bridge_status.json()['payload']['schemaVersion'] == 'gruff-proportion-v1'


@pytest.mark.anyio
async def test_markdown_export_and_event_log(client: httpx.AsyncClient) -> None:
    created = await client.post('/api/blocks', json={'min_col': 2, 'max_col': 5, 'min_row': 1, 'max_row': 2, 'label': 'Feed', 'tone': 'rose'})
    assert created.status_code == 201

    events = await client.get('/api/events')
    assert events.status_code == 200
    event_payload = events.json()
    assert any(event['kind'] == 'block.created' for event in event_payload)

    markdown = await client.get('/api/exports/markdown')
    assert markdown.status_code == 200
    assert 'LO7 Notebook Export' in markdown.text
