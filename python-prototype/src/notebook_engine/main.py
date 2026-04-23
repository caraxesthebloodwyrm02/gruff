from __future__ import annotations

import argparse
import logging

import uvicorn

from notebook_engine.api import build_app
from notebook_engine.grid import GridConfig

logging.basicConfig(
    format='%(asctime)s %(levelname)s %(name)s - %(message)s',
    level=logging.INFO,
)
logger = logging.getLogger('notebook-engine')


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='notebook-engine')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--cell-px', type=int, default=24, dest='cell_px')
    parser.add_argument('--margin-cols', type=int, default=2, dest='margin_cols')
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    config = GridConfig(cell_px=args.cell_px, margin_cols=args.margin_cols)
    logger.info(
        'starting notebook-engine host=%s port=%d cell_px=%d margin_cols=%d',
        args.host,
        args.port,
        config.cell_px,
        config.margin_cols,
    )
    app = build_app(config)
    uvicorn.run(app, host=args.host, port=args.port, log_level='info')


if __name__ == '__main__':
    main()
