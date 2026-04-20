#!/usr/bin/env python3
"""Minimal POST /gruff/proportion stub for the GRUFF wallboard proportion JSON.

No third-party deps (stdlib only). Validates required top-level keys, echoes
summary to stdout, responds 202. For local contract testing before wiring the
real Echoes FastAPI app.

Usage::

    python3 bridges/gruff-echoes/receiver.py
    PORT=8766 python3 bridges/gruff-echoes/receiver.py   # if 8765 is busy

    # then from another shell:
    curl -sS -X POST http://127.0.0.1:8765/gruff/proportion \\
      -H 'Content-Type: application/json' \\
      -d @proportion.json

If bind fails with "Address already in use", stop the old listener::

    kill $(lsof -t -iTCP:8765 -sTCP:LISTEN)
"""

from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any


class ReusableHTTPServer(HTTPServer):
    allow_reuse_address = True

REQUIRED = (
    "schemaVersion",
    "t",
    "theta",
    "cog",
    "weights",
    "modulation",
    "sequence",
    "metrics",
    "audioDrive",
)


def validate_payload(data: Any) -> str | None:
    if not isinstance(data, dict):
        return "body must be a JSON object"
    for k in REQUIRED:
        if k not in data:
            return f"missing field: {k}"
    if data.get("schemaVersion") != "1.0.0":
        return "unsupported schemaVersion"
    w = data.get("weights")
    if not isinstance(w, dict):
        return "weights must be object"
    for key in ("sound", "gesture", "calculation"):
        if key not in w:
            return f"weights missing {key}"
    try:
        s = float(w["sound"]) + float(w["gesture"]) + float(w["calculation"])
    except (TypeError, ValueError):
        return "weights must be numeric"
    if abs(s - 1.0) > 0.02:
        return f"weights must sum to ~1 (got {s:.4f})"
    return None


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: Any) -> None:
        sys.stderr.write("%s - - [%s] %s\n" % (self.client_address[0], self.log_date_time_string(), fmt % args))

    @staticmethod
    def _safe_write(wfile: Any, data: bytes) -> None:
        try:
            wfile.write(data)
        except BrokenPipeError:
            pass

    def do_GET(self) -> None:  # noqa: N802
        """Health-style probe: GET returns 405 so curl checks do not trip 501 + traceback."""
        if self.path != "/gruff/proportion":
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self._safe_write(self.wfile, b'{"error":"not found"}\n')
            return
        self.send_response(405)
        self.send_header("Allow", "POST")
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self._safe_write(
            self.wfile,
            b'{"error":"method not allowed","hint":"POST JSON to this path"}\n',
        )

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/gruff/proportion":
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self._safe_write(self.wfile, b'{"error":"not found"}\n')
            return
        length = int(self.headers.get("Content-Length", "0") or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            data = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as e:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self._safe_write(self.wfile, json.dumps({"ok": False, "error": str(e)}).encode())
            return
        err = validate_payload(data)
        if err:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self._safe_write(self.wfile, json.dumps({"ok": False, "error": err}).encode())
            return
        ad = float(data["audioDrive"])
        print(f"[gruff-echoes] accepted theta={data.get('theta')} audioDrive={ad:.4f}", flush=True)
        body = {
            "ok": True,
            "accepted": True,
            "audioDrive": ad,
            "step": data.get("sequence", {}),
        }
        self.send_response(202)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self._safe_write(self.wfile, json.dumps(body).encode())


def main() -> None:
    host = "127.0.0.1"
    port = int(os.environ.get("PORT", "8765"))
    try:
        httpd = ReusableHTTPServer((host, port), Handler)
    except OSError as e:
        if e.errno == 98:  # Address already in use (Linux)
            print(
                f"Port {port} is already in use. Either reuse that server for POSTs, or stop it:\n"
                f"  kill $(lsof -t -iTCP:{port} -sTCP:LISTEN)\n"
                f"Or pick another port:  PORT=8766 python3 {sys.argv[0]}",
                file=sys.stderr,
                flush=True,
            )
        raise SystemExit(1) from e
    print(f"gruff-echoes stub listening on http://{host}:{port}/gruff/proportion", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nshutdown", flush=True)


if __name__ == "__main__":
    main()
