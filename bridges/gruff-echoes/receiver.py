from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'python-prototype' / 'data' / 'gruff-echoes-received.json'


class Receiver(BaseHTTPRequestHandler):
    def do_POST(self) -> None:  # noqa: N802
        if self.path != '/gruff/proportion':
            self.send_error(HTTPStatus.NOT_FOUND, 'Unknown path')
            return

        length = int(self.headers.get('Content-Length', '0'))
        payload = self.rfile.read(length).decode('utf-8')
        data = json.loads(payload)
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(data, indent=2), encoding='utf-8')

        response = {'received': True, 'path': str(OUTPUT), 'schemaVersion': data.get('schemaVersion')}
        encoded = json.dumps(response).encode('utf-8')
        self.send_response(HTTPStatus.OK)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


if __name__ == '__main__':
    host = '127.0.0.1'
    port = 8765
    server = ThreadingHTTPServer((host, port), Receiver)
    print(f'gruff-echoes receiver listening on http://{host}:{port}/gruff/proportion')
    server.serve_forever()
