from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from notebook_engine.craft import CommandCraftRenderer
from notebook_engine.grid import GridConfig
from notebook_engine.service import NotebookService


def default_manifest_path() -> Path:
    return Path(__file__).resolve().parents[2] / 'data' / 'notebook.manifest.json'


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def build_service(manifest_path: Path | None = None, *, craft_required: bool = True) -> NotebookService:
    root = repo_root()
    return NotebookService(
        manifest_path=manifest_path or default_manifest_path(),
        grid_config=GridConfig(),
        craft_renderer=CommandCraftRenderer(command=None if not craft_required else os.environ.get('LO7_CRAFT_RENDER_COMMAND')),
        schema_path=root / 'schemas' / 'trust-event-v1.schema.json',
        bridge_schema_path=root / 'schemas' / 'gruff-proportion-v1.schema.json',
        manifest_schema_path=root / 'schemas' / 'notebook-manifest-v1.schema.json',
        craft_required=craft_required,
    )


def _print_payload(payload: object, *, as_json: bool) -> None:
    if as_json:
        print(json.dumps(payload, indent=2))
        return
    print(payload)


def run_lo7_manifest(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog='lo7-manifest')
    parser.add_argument('--manifest-path', type=Path, default=default_manifest_path())
    parser.add_argument('--json', action='store_true')
    subparsers = parser.add_subparsers(dest='command', required=True)

    subparsers.add_parser('show')
    subparsers.add_parser('validate')
    subparsers.add_parser('watch')

    diff_parser = subparsers.add_parser('diff')
    diff_parser.add_argument('other', type=Path)

    args = parser.parse_args(argv)
    service = build_service(args.manifest_path, craft_required=False)

    if args.command == 'show':
        _print_payload(service.get_manifest().model_dump(mode='json'), as_json=args.json)
        return

    if args.command == 'validate':
        status = service.health_status()
        _print_payload(status.__dict__, as_json=args.json)
        return

    if args.command == 'watch':
        payload = {
            'revision': service.get_manifest().current_revision_id,
            'events': [event.model_dump(mode='json') for event in service.list_events(limit=5)],
        }
        _print_payload(payload, as_json=True)
        return

    if args.command == 'diff':
        current = service.get_manifest().model_dump(mode='json')
        other = json.loads(args.other.read_text(encoding='utf-8'))
        payload = {
            'current_revision': current['current_revision_id'],
            'other_revision': other.get('current_revision_id'),
            'block_delta': len(current['blocks']) - len(other.get('blocks', [])),
        }
        _print_payload(payload, as_json=True)


def run_lo7_heatmap(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog='lo7-heatmap')
    parser.add_argument('--manifest-path', type=Path, default=default_manifest_path())
    parser.add_argument('--output', type=Path, default=default_manifest_path().parent / 'heatmap.html')
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args(argv)
    service = build_service(args.manifest_path, craft_required=False)
    html = service.render_heatmap_html()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(html, encoding='utf-8')
    _print_payload({'output': str(args.output), 'revision': service.get_manifest().current_revision_id}, as_json=args.json)


def run_lo7_compass(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog='lo7-compass')
    parser.add_argument('--manifest-path', type=Path, default=default_manifest_path())
    parser.add_argument('--json', action='store_true')
    subparsers = parser.add_subparsers(dest='command', required=True)

    metrics_parser = subparsers.add_parser('metrics')
    metrics_parser.add_argument('--profile', default='default')
    render_parser = subparsers.add_parser('render')
    render_parser.add_argument('--profile', default='default')
    subparsers.add_parser('status')
    subparsers.add_parser('emit-bridge')

    args = parser.parse_args(argv)
    service = build_service(args.manifest_path, craft_required=args.command in {'render', 'emit-bridge'})

    if args.command == 'metrics':
        _print_payload(service.derive_metrics().model_dump(mode='json'), as_json=True if args.json else True)
        return
    if args.command == 'render':
        payload = service.render_compass(profile=args.profile)
        _print_payload(payload, as_json=True if args.json else True)
        return
    if args.command == 'status':
        _print_payload(service.compass_status(), as_json=True if args.json else True)
        return
    if args.command == 'emit-bridge':
        _print_payload(service.emit_bridge_payload(), as_json=True if args.json else True)


def run_lo7_compact(argv: list[str] | None = None) -> None:
    """Compact command: estimate or execute manifest retention policy."""
    parser = argparse.ArgumentParser(prog='lo7-compact')
    parser.add_argument('--manifest-path', type=Path, default=default_manifest_path())
    parser.add_argument('--max-revisions', type=int, default=None, help='Override max_revisions retention knob')
    parser.add_argument('--max-events', type=int, default=None, help='Override max_events retention knob')
    parser.add_argument('--archive-path', type=Path, default=None, help='Override archive path')
    parser.add_argument('--dry-run', action='store_true', default=True, help='Estimate impact (default: true)')
    parser.add_argument('--execute', action='store_false', dest='dry_run', help='Execute compaction (disables dry-run)')
    parser.add_argument('--json', action='store_true')

    args = parser.parse_args(argv)
    service = build_service(args.manifest_path, craft_required=False)

    # Apply retention overrides if provided
    if args.max_revisions is not None or args.max_events is not None:
        manifest = service.get_manifest()
        manifest.max_revisions = args.max_revisions or manifest.max_revisions
        manifest.max_events = args.max_events or manifest.max_events
        if args.archive_path:
            manifest.archive_path = str(args.archive_path)
        service.replace_manifest(manifest, expected_revision_id=None, actor='compact-cli')

    result = service.compact(dry_run=args.dry_run)
    _print_payload(result, as_json=args.json)
