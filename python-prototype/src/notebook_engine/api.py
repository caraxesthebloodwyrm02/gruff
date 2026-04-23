from __future__ import annotations

from contextlib import ExitStack, asynccontextmanager
from importlib.resources import as_file, files
from pathlib import Path

from fastapi import FastAPI, HTTPException, Response, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from notebook_engine.blocks import (
    Block,
    BlockCreate,
    BlockStore,
    BlockValidationError,
    InMemoryBlockStore,
    create_block_for_grid,
)
from notebook_engine.grid import GridConfig


def _load_static_dir() -> tuple[ExitStack, Path]:
    resource_stack = ExitStack()
    static_dir = Path(resource_stack.enter_context(as_file(files('notebook_engine').joinpath('static'))))
    return resource_stack, static_dir


def build_app(
    config: GridConfig,
    *,
    store: BlockStore | None = None,
) -> FastAPI:
    static_stack, static_dir = _load_static_dir()

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        try:
            yield
        finally:
            static_stack.close()

    app = FastAPI(title='notebook-engine', version='0.1.0', lifespan=lifespan)
    block_store = store or InMemoryBlockStore()
    index_html = (static_dir / 'index.html').read_text(encoding='utf-8')

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
        except BlockValidationError as exc:
            raise RequestValidationError([exc.to_request_error()]) from exc

    @app.delete('/api/blocks/{block_id}', status_code=status.HTTP_204_NO_CONTENT)
    async def api_blocks_delete(block_id: str) -> Response:
        if not block_store.delete(block_id):
            raise HTTPException(status_code=404, detail='Block not found')
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    @app.post('/api/blocks/clear', status_code=status.HTTP_204_NO_CONTENT)
    async def api_blocks_clear() -> Response:
        block_store.clear()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    app.mount('/static', StaticFiles(directory=str(static_dir)), name='static')

    return app
