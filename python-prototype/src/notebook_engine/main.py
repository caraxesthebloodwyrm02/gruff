from __future__ import annotations

import argparse
import logging
from pathlib import Path

import uvicorn

from notebook_engine.api import build_app
from notebook_engine.cli import build_service, default_manifest_path

logging.basicConfig(format='%(asctime)s %(levelname)s %(name)s - %(message)s', level=logging.INFO)
logger = logging.getLogger('notebook-engine')


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='notebook-engine')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--manifest-path', type=Path, default=default_manifest_path())
    parser.add_argument('--allow-missing-craft', action='store_true', default=False)
    return parser.parse_args(argv)


def main() -> None:
    args = parse_args()
    craft_required = not args.allow_missing_craft
    service = build_service(args.manifest_path, craft_required=craft_required)
    logger.info(
        'starting notebook-engine host=%s port=%d manifest=%s craft_required=%s',
        args.host,
        args.port,
        args.manifest_path,
        craft_required,
    )
    app = build_app(service=service)
    uvicorn.run(app, host=args.host, port=args.port, log_level='info')


if __name__ == '__main__':
    main()
