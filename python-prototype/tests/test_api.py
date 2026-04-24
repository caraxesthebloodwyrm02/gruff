from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from notebook_engine.api import build_app
from notebook_engine.blocks import BlockCreate

from service_doubles import make_notebook_service


@pytest.fixture
def app(tmp_path: Path):
    return build_app(service=make_notebook_service(tmp_path))


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
async def test_block_mutations_honor_expected_revision(client: httpx.AsyncClient) -> None:
    head = (await client.get('/api/manifest')).json()['current_revision_id']
    await client.post(
        '/api/blocks',
        json={'min_col': 2, 'max_col': 4, 'min_row': 1, 'max_row': 3, 'label': 'A', 'tone': 'mint'},
    )
    stale = await client.post(
        '/api/blocks?expected_revision_id=' + head,
        json={'min_col': 5, 'max_col': 7, 'min_row': 1, 'max_row': 2, 'label': 'B', 'tone': 'azure'},
    )
    assert stale.status_code == 409


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
    assert dry_run.json()['valid_count'] == 1
    assert dry_run.json()['invalid_count'] == 0
    assert dry_run.json()['imported_count'] == 0
    assert (await client.get('/api/manifest')).json()['blocks'] == []

    committed = await client.post('/api/exports/csv-import', content=csv_text, headers={'content-type': 'text/plain'})
    assert committed.status_code == 200
    assert committed.json()['dry_run'] is False
    assert committed.json()['valid_count'] == 1
    assert committed.json()['invalid_count'] == 0
    assert committed.json()['imported_count'] == 1
    assert len((await client.get('/api/manifest')).json()['blocks']) == 1


@pytest.mark.anyio
async def test_csv_import_rejects_malformed_rows_without_partial(client: httpx.AsyncClient) -> None:
    csv_text = (
        'min_col,max_col,min_row,max_row,label,tone\n'
        '2,4,1,2,Good,azure\n'
        'oops,4,1,2,Bad,azure\n'
    )
    res = await client.post('/api/exports/csv-import', content=csv_text, headers={'content-type': 'text/plain'})
    assert res.status_code == 422
    assert res.json()['detail']['valid_count'] == 1
    assert res.json()['detail']['invalid_count'] == 1
    assert res.json()['detail']['imported_count'] == 0
    assert res.json()['detail']['aborted'] is True
    assert any(err.get('field') == 'min_col' for err in res.json()['detail']['errors'])
    assert (await client.get('/api/manifest')).json()['blocks'] == []


@pytest.mark.anyio
async def test_csv_import_partial_skips_bad_rows(client: httpx.AsyncClient) -> None:
    csv_text = (
        'min_col,max_col,min_row,max_row,label,tone\n'
        '2,4,1,2,Good,azure\n'
        'oops,4,1,2,Bad,azure\n'
    )
    res = await client.post('/api/exports/csv-import?partial=true', content=csv_text, headers={'content-type': 'text/plain'})
    assert res.status_code == 200
    assert res.json()['valid_count'] == 1
    assert res.json()['invalid_count'] == 1
    assert res.json()['imported_count'] == 1
    assert res.json()['skipped_count'] == 1
    assert len((await client.get('/api/manifest')).json()['blocks']) == 1


@pytest.mark.anyio
async def test_csv_import_rejects_missing_required_columns(client: httpx.AsyncClient) -> None:
    csv_text = 'min_col,min_row,label\n2,1,Orphan col\n'
    res = await client.post('/api/exports/csv-import?dry_run=true', content=csv_text, headers={'content-type': 'text/plain'})
    assert res.status_code == 422
    errors = res.json()['detail']['errors']
    assert any(e['field'] == 'max_col' for e in errors)
    assert any(e['field'] == 'max_row' for e in errors)
    assert res.json()['detail']['valid_count'] == 0


@pytest.mark.anyio
async def test_csv_import_rejects_invalid_integer_parsing(client: httpx.AsyncClient) -> None:
    csv_text = (
        'min_col,max_col,min_row,max_row\n'
        '2,notanint,1,2\n'          # bad max_col
        '3,5,alright,2\n'           # bad min_row
        '3,5,1,two\n'               # bad max_row
        '2,4,1,2\n'                 # valid row
    )
    res = await client.post('/api/exports/csv-import?dry_run=true', content=csv_text, headers={'content-type': 'text/plain'})
    assert res.status_code == 200
    body = res.json()
    assert body['valid_count'] == 1
    assert body['invalid_count'] == 3
    errors_by_field = {e['field'] for e in body['errors']}
    assert 'max_col' in errors_by_field
    assert 'min_row' in errors_by_field
    assert 'max_row' in errors_by_field


@pytest.mark.anyio
async def test_csv_import_rejects_out_of_range_bounds(client: httpx.AsyncClient) -> None:
    csv_text = (
        'min_col,max_col,min_row,max_row,label,tone\n'
        '1,4,1,2,In margin,amber\n'    # min_col < margin_cols(2)
        '3,2,1,2,Inverted col,azure\n'  # min_col > max_col
        '3,6,5,3,Inverted row,mint\n'  # min_row > max_row
        '2,4,1,2,Good,rose\n'           # valid
    )
    res = await client.post('/api/exports/csv-import?dry_run=true', content=csv_text, headers={'content-type': 'text/plain'})
    assert res.status_code == 200
    body = res.json()
    assert body['valid_count'] == 1
    assert body['invalid_count'] == 3
    errors_by_field = {e['field'] for e in body['errors']}
    assert 'min_col' in errors_by_field   # margin violation
    assert 'max_col' in errors_by_field   # col inversion
    assert 'max_row' in errors_by_field   # row inversion


@pytest.mark.anyio
async def test_csv_import_rejects_invalid_tone(client: httpx.AsyncClient) -> None:
    csv_text = (
        'min_col,max_col,min_row,max_row,label,tone\n'
        '2,4,1,2,Bad tone 1,toxic\n'
        '2,4,1,3,Bad tone 2,purple\n'
        '2,4,1,4,Good,mint\n'
    )
    res = await client.post('/api/exports/csv-import?dry_run=true', content=csv_text, headers={'content-type': 'text/plain'})
    assert res.status_code == 200
    body = res.json()
    assert body['valid_count'] == 1
    assert body['invalid_count'] == 2
    tone_errors = [e for e in body['errors'] if e['field'] == 'tone']
    assert len(tone_errors) == 2


@pytest.mark.anyio
async def test_csv_import_partial_with_mixed_valid_invalid_rows(client: httpx.AsyncClient) -> None:
    csv_text = (
        'min_col,max_col,min_row,max_row,label,tone\n'
        '2,4,1,2,Valid 1,amber\n'
        'oops,4,1,3,Bad int,mint\n'
        '2,4,4,5,Valid 2,azure\n'
        '2,4,6,7,Bad tone,purple\n'
        '2,4,8,9,Valid 3,rose\n'
    )
    res = await client.post('/api/exports/csv-import?partial=true', content=csv_text, headers={'content-type': 'text/plain'})
    assert res.status_code == 200
    body = res.json()
    assert body['valid_count'] == 3
    assert body['invalid_count'] == 2
    assert body['imported_count'] == 3
    assert body['skipped_count'] == 2
    assert len((await client.get('/api/manifest')).json()['blocks']) == 3


@pytest.mark.anyio
async def test_csv_import_partial_false_aborts_on_any_error(client: httpx.AsyncClient) -> None:
    csv_text = (
        'min_col,max_col,min_row,max_row,label,tone\n'
        '2,4,1,2,Valid,amber\n'
        '2,4,1,3,Bad int,oops\n'
        '2,4,4,5,Valid 2,azure\n'
    )
    res = await client.post('/api/exports/csv-import?partial=false', content=csv_text, headers={'content-type': 'text/plain'})
    assert res.status_code == 422
    body = res.json()['detail']
    assert body['aborted'] is True
    assert body['imported_count'] == 0
    assert body['invalid_count'] == 1
    assert len((await client.get('/api/manifest')).json()['blocks']) == 0


def test_manifest_history_compaction_archives_old_revisions(tmp_path: Path) -> None:
    service = make_notebook_service(tmp_path, max_inline_history=6)
    for i in range(8):
        service.create_block(
            BlockCreate(min_col=2, max_col=4, min_row=1, max_row=2, label=f'B{i}', tone='mint'),
        )
    manifest = service.get_manifest()
    assert len(manifest.revisions) == 6
    archive = tmp_path / 'notebook.manifest.json.history.jsonl'
    assert archive.exists()
    assert archive.read_text(encoding='utf-8').count('\n') >= 3


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


@pytest.mark.anyio
async def test_notebook_mutation_emits_audit_event(tmp_path: Path) -> None:
    audit_path = tmp_path / 'audit.ndjson'
    app = build_app(service=make_notebook_service(tmp_path, audit_enabled=True, audit_path=audit_path))
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url='http://testserver') as client:
        response = await client.post(
            '/api/blocks',
            json={'min_col': 2, 'max_col': 4, 'min_row': 1, 'max_row': 2, 'label': 'Audit', 'tone': 'mint'},
        )
        assert response.status_code == 201
    assert audit_path.exists()
    lines = audit_path.read_text(encoding='utf-8').strip().splitlines()
    assert lines, 'expected at least one audit line'
    payload = json.loads(lines[-1])
    assert payload['tool'] == 'block.create'
    assert payload['status'] == 'success'
    assert payload['metadata']['entity_id'] == 'notebook-engine'


@pytest.mark.anyio
async def test_audit_emission_can_be_disabled(tmp_path: Path) -> None:
    audit_path = tmp_path / 'audit.ndjson'
    app = build_app(service=make_notebook_service(tmp_path, audit_enabled=False, audit_path=audit_path))
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url='http://testserver') as client:
        response = await client.post(
            '/api/blocks',
            json={'min_col': 2, 'max_col': 4, 'min_row': 1, 'max_row': 2, 'label': 'NoAudit', 'tone': 'mint'},
        )
        assert response.status_code == 201
    assert not audit_path.exists()
