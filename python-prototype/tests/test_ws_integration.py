"""Integration tests for the /ws real-time channel (contract, mutations, compass, reconnect)."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from notebook_engine.api import LiveNotebookHub, build_app

from service_doubles import FakeCraftRenderer, make_notebook_service


def _expect_manifest_updated_pair(ws) -> tuple[dict, dict]:
    """After a mutating HTTP call, receive manifest.updated then revision.created."""
    m1 = ws.receive_json()
    m2 = ws.receive_json()
    assert m1['type'] == 'manifest.updated'
    assert m2['type'] == 'revision.created'
    assert isinstance(m1.get('evt'), int)
    assert isinstance(m2.get('evt'), int)
    assert m2['evt'] > m1['evt']
    return m1, m2


def test_ws_hello_payload_shape(tmp_path: Path) -> None:
    app = build_app(service=make_notebook_service(tmp_path))
    client = TestClient(app)
    with client.websocket_connect('/ws', timeout=2) as ws:
        hello = ws.receive_json()
    assert hello['type'] == 'hello'
    assert isinstance(hello.get('evt'), int)
    assert hello.get('revisionId') is not None
    manifest = hello['manifest']
    assert manifest['schema_version'] == 'notebook-manifest-v1'
    assert 'notebook_id' in manifest
    assert 'current_revision_id' in manifest
    assert isinstance(hello['blocks'], list)
    assert isinstance(hello['revisions'], list)
    assert len(hello['revisions']) <= 5


def test_ws_manifest_updated_on_create_delete_clear(tmp_path: Path) -> None:
    app = build_app(service=make_notebook_service(tmp_path))
    client = TestClient(app)
    with client.websocket_connect('/ws', timeout=2) as ws:
        ws.receive_json()

        r = client.post(
            '/api/blocks',
            json={'min_col': 2, 'max_col': 4, 'min_row': 1, 'max_row': 2, 'label': 'A', 'tone': 'mint'},
        )
        assert r.status_code == 201
        m1, m2 = _expect_manifest_updated_pair(ws)
        assert m1['revisionId'] == m2['revision']['revision_id']
        assert len(m1['blocks']) == 1

        bid = r.json()['id']
        d = client.delete(f'/api/blocks/{bid}')
        assert d.status_code == 204
        m3, m4 = _expect_manifest_updated_pair(ws)
        assert m3['blocks'] == []

        client.post(
            '/api/blocks',
            json={'min_col': 3, 'max_col': 5, 'min_row': 1, 'max_row': 2, 'label': 'B', 'tone': 'azure'},
        )
        _expect_manifest_updated_pair(ws)

        c = client.post('/api/blocks/clear')
        assert c.status_code == 204
        m5, m6 = _expect_manifest_updated_pair(ws)
        assert m5.get('cleared') is True
        assert m5['blocks'] == []
        assert m6['evt'] > m5['evt']


def test_ws_compass_render_started_completed(tmp_path: Path) -> None:
    app = build_app(service=make_notebook_service(tmp_path))
    client = TestClient(app)
    client.post(
        '/api/blocks',
        json={'min_col': 2, 'max_col': 5, 'min_row': 1, 'max_row': 2, 'label': 'C', 'tone': 'rose'},
    )
    with client.websocket_connect('/ws', timeout=2) as ws:
        ws.receive_json()  # hello
        r = client.post('/api/compass/render?profile=diagnostic')
        assert r.status_code == 200
        s = ws.receive_json()
        assert s['type'] == 'compass.render.started'
        assert s['profile'] == 'diagnostic'
        assert isinstance(s.get('evt'), int)
        done = ws.receive_json()
        assert done['type'] == 'compass.render.completed'
        assert done['evt'] > s['evt']
        assert done.get('renderer') == 'craft-server'


def test_ws_compass_render_started_failed(tmp_path: Path) -> None:
    renderer = FakeCraftRenderer(tmp_path, fail_profiles=frozenset({'broken'}))
    service = make_notebook_service(tmp_path, craft_renderer=renderer)
    app = build_app(service=service)
    client = TestClient(app)
    client.post(
        '/api/blocks',
        json={'min_col': 2, 'max_col': 5, 'min_row': 1, 'max_row': 2, 'label': 'D', 'tone': 'slate'},
    )
    with client.websocket_connect('/ws', timeout=2) as ws:
        ws.receive_json()
        r = client.post('/api/compass/render?profile=broken')
        assert r.status_code == 503
        s = ws.receive_json()
        assert s['type'] == 'compass.render.started'
        assert s['profile'] == 'broken'
        fail = ws.receive_json()
        assert fail['type'] == 'compass.render.failed'
        assert fail['evt'] > s['evt']
        assert 'error' in fail


def test_ws_reconnect_disconnect_and_resubscribe(tmp_path: Path) -> None:
    app = build_app(service=make_notebook_service(tmp_path))
    client = TestClient(app)
    evts: list[int] = []
    with client.websocket_connect('/ws', timeout=2) as ws:
        h1 = ws.receive_json()
        assert h1['type'] == 'hello'
        evts.append(h1['evt'])

    with client.websocket_connect('/ws', timeout=2) as ws2:
        h2 = ws2.receive_json()
        assert h2['type'] == 'hello'
        evts.append(h2['evt'])

    assert evts[1] > evts[0], 'evt counter should advance across connections'

    with client.websocket_connect('/ws', timeout=2) as ws3:
        h3 = ws3.receive_json()
        client.post(
            '/api/blocks',
            json={'min_col': 2, 'max_col': 4, 'min_row': 1, 'max_row': 2, 'label': 'E', 'tone': 'mint'},
        )
        m1 = ws3.receive_json()
        assert m1['type'] == 'manifest.updated'
        assert m1['evt'] > h3['evt']


def test_live_notebook_hub_broadcast_includes_evt_ids() -> None:
    hub = LiveNotebookHub(send_timeout_s=1.0)
    assert hub.next_evt_id() == 1
    assert hub.next_evt_id() == 2
