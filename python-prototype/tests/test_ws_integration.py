"""Integration tests for the /ws real-time channel (contract, mutations, compass, reconnect)."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from notebook_engine.api import LiveNotebookHub, build_app
from notebook_engine.test_doubles import FakeCraftRenderer, make_notebook_service


class InProcessWebSocket:
    def __init__(self, app, *, path: str = '/ws') -> None:
        self.app = app
        self.path = path
        self._incoming: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        self._outgoing: asyncio.Queue[str] = asyncio.Queue()
        self._task: asyncio.Task[None] | None = None

    async def __aenter__(self) -> 'InProcessWebSocket':
        scope = {
            'type': 'websocket',
            'asgi': {'version': '3.0'},
            'scheme': 'ws',
            'http_version': '1.1',
            'method': 'GET',
            'path': self.path,
            'raw_path': self.path.encode(),
            'query_string': b'',
            'headers': [],
            'client': ('testclient', 50000),
            'server': ('testserver', 80),
            'subprotocols': [],
            'state': {},
        }

        await self._incoming.put({'type': 'websocket.connect'})

        async def receive() -> dict[str, Any]:
            return await self._incoming.get()

        async def send(message: dict[str, Any]) -> None:
            if message['type'] == 'websocket.accept':
                return
            if message['type'] == 'websocket.send':
                text = message.get('text')
                if text is None:
                    text = message.get('bytes', b'').decode()
                await self._outgoing.put(text)
                return
            if message['type'] == 'websocket.close':
                await self._outgoing.put(json.dumps({'type': 'websocket.close', 'code': message.get('code', 1000)}))

        self._task = asyncio.create_task(self.app(scope, receive, send))
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        await self._incoming.put({'type': 'websocket.disconnect', 'code': 1000})
        if self._task is not None:
            await asyncio.wait_for(self._task, timeout=2.0)

    async def recv_json(self, *, timeout_s: float = 2.0) -> dict[str, Any]:
        payload = await asyncio.wait_for(self._outgoing.get(), timeout=timeout_s)
        return json.loads(payload)
@pytest.mark.anyio
async def test_ws_hello_payload_shape(tmp_path: Path) -> None:
    app = build_app(service=make_notebook_service(tmp_path))
    async with InProcessWebSocket(app) as ws:
        hello = await ws.recv_json()
    assert hello['type'] == 'hello'
    assert isinstance(hello.get('evt'), int)
    assert hello.get('revisionId') is not None
    assert hello['manifest']['schema_version'] == 'notebook-manifest-v1'
    assert isinstance(hello['blocks'], list)
    assert isinstance(hello['revisions'], list)
    assert len(hello['revisions']) <= 5


async def _manifest_updated_pair(ws: InProcessWebSocket) -> tuple[dict[str, Any], dict[str, Any]]:
    m1 = await ws.recv_json()
    m2 = await ws.recv_json()
    assert m1['type'] == 'manifest.updated'
    assert m2['type'] == 'revision.created'
    assert isinstance(m1.get('evt'), int)
    assert isinstance(m2.get('evt'), int)
    assert m2['evt'] > m1['evt']
    return m1, m2


@pytest.mark.anyio
async def test_ws_manifest_updated_on_create_delete_clear(tmp_path: Path) -> None:
    app = build_app(service=make_notebook_service(tmp_path))
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url='http://testserver') as client:
        async with InProcessWebSocket(app) as ws:
            await ws.recv_json()

            created = await client.post(
                '/api/blocks',
                json={'min_col': 2, 'max_col': 4, 'min_row': 1, 'max_row': 2, 'label': 'A', 'tone': 'mint'},
            )
            assert created.status_code == 201
            m1, m2 = await _manifest_updated_pair(ws)
            assert m1['revisionId'] == m2['revision']['revision_id']
            assert len(m1['blocks']) == 1

            deleted = await client.delete(f"/api/blocks/{created.json()['id']}")
            assert deleted.status_code == 204
            m3, _ = await _manifest_updated_pair(ws)
            assert m3['blocks'] == []

            await client.post(
                '/api/blocks',
                json={'min_col': 3, 'max_col': 5, 'min_row': 1, 'max_row': 2, 'label': 'B', 'tone': 'azure'},
            )
            await _manifest_updated_pair(ws)

            cleared = await client.post('/api/blocks/clear')
            assert cleared.status_code == 204
            m5, m6 = await _manifest_updated_pair(ws)
            assert m5.get('cleared') is True
            assert m5['blocks'] == []
            assert m6['evt'] > m5['evt']


@pytest.mark.anyio
async def test_ws_compass_render_started_completed(tmp_path: Path) -> None:
    app = build_app(service=make_notebook_service(tmp_path))
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url='http://testserver') as client:
        await client.post(
            '/api/blocks',
            json={'min_col': 2, 'max_col': 5, 'min_row': 1, 'max_row': 2, 'label': 'C', 'tone': 'rose'},
        )
        async with InProcessWebSocket(app) as ws:
            await ws.recv_json()
            rendered = await client.post('/api/compass/render?profile=diagnostic')
            assert rendered.status_code == 200
            started = await ws.recv_json()
            completed = await ws.recv_json()
            assert started['type'] == 'compass.render.started'
            assert started['profile'] == 'diagnostic'
            assert completed['type'] == 'compass.render.completed'
            assert completed['evt'] > started['evt']
            assert completed.get('renderer') == 'craft-server'


@pytest.mark.anyio
async def test_ws_compass_render_started_failed(tmp_path: Path) -> None:
    renderer = FakeCraftRenderer(tmp_path, fail_profiles=frozenset({'broken'}))
    app = build_app(service=make_notebook_service(tmp_path, craft_renderer=renderer))
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url='http://testserver') as client:
        await client.post(
            '/api/blocks',
            json={'min_col': 2, 'max_col': 5, 'min_row': 1, 'max_row': 2, 'label': 'D', 'tone': 'slate'},
        )
        async with InProcessWebSocket(app) as ws:
            await ws.recv_json()
            failed = await client.post('/api/compass/render?profile=broken')
            assert failed.status_code == 503
            started = await ws.recv_json()
            failure = await ws.recv_json()
            assert started['type'] == 'compass.render.started'
            assert failure['type'] == 'compass.render.failed'
            assert failure['evt'] > started['evt']
            assert 'error' in failure


@pytest.mark.anyio
async def test_ws_reconnect_disconnect_and_resubscribe(tmp_path: Path) -> None:
    app = build_app(service=make_notebook_service(tmp_path))
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url='http://testserver') as client:
        async with InProcessWebSocket(app) as ws1:
            hello1 = await ws1.recv_json()

        async with InProcessWebSocket(app) as ws2:
            hello2 = await ws2.recv_json()
            assert hello2['evt'] > hello1['evt']

        async with InProcessWebSocket(app) as ws3:
            hello3 = await ws3.recv_json()
            await client.post(
                '/api/blocks',
                json={'min_col': 2, 'max_col': 4, 'min_row': 1, 'max_row': 2, 'label': 'E', 'tone': 'mint'},
            )
            updated = await ws3.recv_json()
            assert updated['type'] == 'manifest.updated'
            assert updated['evt'] > hello3['evt']


def test_live_notebook_hub_broadcast_includes_evt_ids() -> None:
    hub = LiveNotebookHub(send_timeout_s=1.0)
    assert hub.next_evt_id() == 1
    assert hub.next_evt_id() == 2
