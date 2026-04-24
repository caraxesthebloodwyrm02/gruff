from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import Body, FastAPI, HTTPException, Query, Response, WebSocket, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.websockets import WebSocketDisconnect
from fastapi.staticfiles import StaticFiles

from notebook_engine.blocks import Block, BlockCreate, BlockValidationError
from notebook_engine.manifest import NotebookManifest
from notebook_engine.service import NotebookService


class LiveNotebookHub:
    """Fan-out for notebook runtime events. Each outbound frame gets a monotonic ``evt`` id for client de-duplication."""

    def __init__(self, *, send_timeout_s: float = 5.0) -> None:
        self._connections: set[WebSocket] = set()
        self.send_timeout_s = send_timeout_s
        self._evt_seq = 0

    def next_evt_id(self) -> int:
        self._evt_seq += 1
        return self._evt_seq

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)

    async def broadcast(self, event_type: str, payload: dict[str, object]) -> None:
        if not self._connections:
            return

        evt_id = self.next_evt_id()
        message: dict[str, object] = {'type': event_type, 'evt': evt_id, **payload}
        stale_connections: list[WebSocket] = []
        for websocket in self._connections:
            try:
                await asyncio.wait_for(websocket.send_json(message), timeout=self.send_timeout_s)
            except (WebSocketDisconnect, asyncio.TimeoutError, TimeoutError):
                stale_connections.append(websocket)
            except Exception:
                stale_connections.append(websocket)
        for websocket in stale_connections:
            self.disconnect(websocket)

def build_app(*, service: NotebookService) -> FastAPI:
    service.startup_preflight()
    static_dir = Path(__file__).resolve().parent / 'static'
    hub = LiveNotebookHub(send_timeout_s=5.0)
    index_html = (static_dir / 'index.html').read_text(encoding='utf-8')
    app = FastAPI(title='notebook-engine', version='0.2.0')

    async def publish_manifest(event_type: str, *, extra: dict[str, object] | None = None) -> None:
        manifest = service.get_manifest()
        payload: dict[str, object] = {
            'revisionId': manifest.current_revision_id,
            'manifest': manifest.model_dump(mode='json'),
            'blocks': [block.model_dump(mode='json') for block in manifest.blocks],
        }
        if extra:
            payload.update(extra)
        await hub.broadcast(event_type, payload)
        await hub.broadcast(
            'revision.created',
            {
                'revision': manifest.revisions[-1].model_dump(mode='json'),
                'event': manifest.events[-1].model_dump(mode='json'),
            },
        )

    @app.get('/', response_class=HTMLResponse, include_in_schema=False)
    async def index() -> str:
        return index_html

    @app.get('/api/health')
    async def api_health() -> dict[str, object]:
        status_report = service.health_status()
        return {
            'craftReady': status_report.craft_ready,
            'craftDetail': status_report.craft_detail,
            'manifestPath': status_report.manifest_path,
            'schemaPath': status_report.schema_path,
            'bridgeSchemaPath': status_report.bridge_schema_path,
            'currentRevisionId': status_report.current_revision_id,
        }

    @app.get('/api/grid')
    async def api_grid() -> dict[str, object]:
        return service.get_grid().model_dump(mode='json')

    @app.get('/api/blocks', response_model=list[Block])
    async def api_blocks() -> list[Block]:
        return service.list_blocks()

    @app.post('/api/blocks', response_model=Block, status_code=status.HTTP_201_CREATED)
    async def api_blocks_create(
        payload: BlockCreate,
        expected_revision_id: str | None = Query(default=None),
    ) -> Block:
        try:
            _, block = service.create_block(payload, expected_revision_id=expected_revision_id)
        except BlockValidationError as exc:
            raise RequestValidationError([exc.to_request_error()]) from exc
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        await publish_manifest('manifest.updated', extra={'block': block.model_dump(mode='json')})
        return block

    @app.delete('/api/blocks/{block_id}', status_code=status.HTTP_204_NO_CONTENT)
    async def api_blocks_delete(
        block_id: str,
        expected_revision_id: str | None = Query(default=None),
    ) -> Response:
        try:
            _, deleted = service.delete_block(block_id, expected_revision_id=expected_revision_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        if not deleted:
            raise HTTPException(status_code=404, detail='Block not found')
        await publish_manifest('manifest.updated', extra={'blockId': block_id})
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.post('/api/blocks/clear', status_code=status.HTTP_204_NO_CONTENT)
    async def api_blocks_clear(expected_revision_id: str | None = Query(default=None)) -> Response:
        try:
            service.clear_blocks(expected_revision_id=expected_revision_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        await publish_manifest('manifest.updated', extra={'cleared': True})
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.get('/api/manifest')
    async def api_manifest() -> dict[str, object]:
        return service.get_manifest().model_dump(mode='json')

    @app.put('/api/manifest')
    async def api_manifest_put(
        manifest_payload: dict[str, object] = Body(...),
        expected_revision_id: str | None = Query(default=None),
    ) -> dict[str, object]:
        try:
            manifest = NotebookManifest.model_validate(manifest_payload)
            updated = service.replace_manifest(manifest, expected_revision_id=expected_revision_id, actor='api')
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        await publish_manifest('manifest.updated')
        return updated.model_dump(mode='json')

    @app.get('/api/revisions')
    async def api_revisions(limit: int = Query(default=20, ge=1, le=200)) -> list[dict[str, object]]:
        return [revision.model_dump(mode='json') for revision in service.list_revisions(limit=limit)]

    @app.get('/api/events')
    async def api_events(limit: int = Query(default=50, ge=1, le=200)) -> list[dict[str, object]]:
        return [event.model_dump(mode='json') for event in service.list_events(limit=limit)]

    @app.get('/api/exports/markdown', response_class=PlainTextResponse)
    async def api_export_markdown() -> str:
        return service.export_markdown()

    @app.post('/api/exports/csv-import')
    async def api_csv_import(
        csv_text: str = Body(..., media_type='text/plain'),
        dry_run: bool = Query(default=False),
        partial: bool = Query(default=False),
        expected_revision_id: str | None = Query(default=None),
    ) -> dict[str, object]:
        try:
            payload = service.import_csv(
                csv_text,
                dry_run=dry_run,
                partial=partial,
                expected_revision_id=expected_revision_id,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
        if payload.get('aborted'):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=payload)
        if not dry_run:
            await publish_manifest('manifest.updated', extra={'csvImport': payload})
        return payload

    @app.get('/api/compass/status')
    async def api_compass_status() -> dict[str, object]:
        return service.compass_status()

    @app.post('/api/compass/render')
    async def api_compass_render(profile: str = Query(default='default')) -> dict[str, object]:
        await hub.broadcast('compass.render.started', {'profile': profile})
        try:
            payload = service.render_compass(profile=profile)
        except RuntimeError as exc:
            service.emit_audit_event(
                tool='compass.render',
                status='failure',
                metadata={'kind': 'compass.render.failed', 'profile': profile, 'error': str(exc)},
            )
            await hub.broadcast('compass.render.failed', {'profile': profile, 'error': str(exc)})
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        await hub.broadcast('compass.render.completed', payload)
        return payload

    @app.get('/api/bridge/payload')
    async def api_bridge_payload() -> dict[str, object]:
        latest = service.latest_bridge_payload()
        if latest is None:
            raise HTTPException(status_code=404, detail='No bridge payload has been emitted yet')
        return latest

    @app.post('/api/bridge/payload')
    async def api_bridge_payload_emit() -> dict[str, object]:
        payload = service.emit_bridge_payload()
        await hub.broadcast('export.generated', payload)
        return payload

    @app.websocket('/ws')
    async def websocket_events(websocket: WebSocket) -> None:
        await hub.connect(websocket)
        manifest = service.get_manifest()
        try:
            await websocket.send_json(
                {
                    'type': 'hello',
                    'evt': hub.next_evt_id(),
                    'revisionId': manifest.current_revision_id,
                    'manifest': manifest.model_dump(mode='json'),
                    'blocks': [block.model_dump(mode='json') for block in manifest.blocks],
                    'revisions': [revision.model_dump(mode='json') for revision in service.list_revisions(limit=5)],
                }
            )
            while True:
                message = await websocket.receive()
                if message.get('type') == 'websocket.disconnect':
                    break
        except WebSocketDisconnect:
            pass
        finally:
            hub.disconnect(websocket)

    app.mount('/static', StaticFiles(directory=str(static_dir)), name='static')
    return app
