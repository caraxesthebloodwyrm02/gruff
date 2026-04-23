from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from notebook_engine.blocks import (
    Block,
    BlockCreate,
    BlockStore,
    InMemoryBlockStore,
    create_block_for_grid,
)
from notebook_engine.grid import GridConfig

_STATIC_DIR = Path(__file__).resolve().parents[2] / 'static'


def build_app(
    config: GridConfig,
    *,
    store: BlockStore | None = None,
) -> FastAPI:
    app = FastAPI(title='notebook-engine', version='0.1.0')
    block_store = store or InMemoryBlockStore()
    index_html = (_STATIC_DIR / 'index.html').read_text(encoding='utf-8')

    @app.get('/', response_class=HTMLResponse, include_in_schema=False)
    async def index() -> str:
        return index_html

    @app.get('/api/grid', response_model=GridConfig)
    async def api_grid() -> GridConfig:
        return config

    @app.get('/api/blocks', response_model=list[Block])
    async def api_blocks() -> list[Block]:
        return block_store.list()

    @app.post(
        '/api/blocks',
        response_model=Block,
        status_code=status.HTTP_201_CREATED,
    )
    async def api_blocks_create(payload: BlockCreate) -> Block:
        try:
            return create_block_for_grid(
                store=block_store,
                payload=payload,
                margin_cols=config.margin_cols,
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.delete('/api/blocks/{block_id}', status_code=status.HTTP_204_NO_CONTENT)
    async def api_blocks_delete(block_id: str) -> Response:
        if not block_store.delete(block_id):
            raise HTTPException(status_code=404, detail='Block not found')
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.post('/api/blocks/clear', status_code=status.HTTP_204_NO_CONTENT)
    async def api_blocks_clear() -> Response:
        block_store.clear()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    if _STATIC_DIR.exists():
        app.mount('/static', StaticFiles(directory=str(_STATIC_DIR)), name='static')

    return app
