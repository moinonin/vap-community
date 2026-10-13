#!/usr/bin/env python3
"""
VAE Python Ingestion & Analytics Server (Port 8002).

Serves lightweight HTTP endpoints:
- GET  /health           -> Service health and stats
- POST /v1/ingest        -> Ingest and validate observations/evidence
- GET  /v1/sessions/:id  -> Retrieve stored session evidence
- POST /v1/prototype-run -> Run synthetic pipeline flow
"""

import json
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

# Import prototype ingest library functions
CURRENT_DIR = Path(__file__).resolve().parent
REPO_ROOT = CURRENT_DIR.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

try:
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "prototype_ingest", REPO_ROOT / "scripts" / "prototype-ingest.py"
    )
    prototype_ingest = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prototype_ingest)
except Exception as e:
    prototype_ingest = None
    print(f"[python-backend] Warning: could not load prototype-ingest: {e}")

PORT = int(os.environ.get("PORT", "8002"))
HOST = os.environ.get("HOST", "0.0.0.0")
DATA_DIR = Path(os.environ.get("DATA_DIR", "/app/data" if Path("/app").exists() else str(REPO_ROOT / "data")))
DATA_DIR.mkdir(parents=True, exist_ok=True)
STORE_PATH = DATA_DIR / "evidence_store.jsonl"


class VapHttpHandler(BaseHTTPRequestHandler):
    """HTTP request handler for Python ingestion backend."""

    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path in ("/health", "/v1/health"):
            item_count = 0
            if STORE_PATH.exists():
                with STORE_PATH.open("r", encoding="utf-8") as f:
                    item_count = sum(1 for _ in f)

            self._set_headers(200)
            res = {
                "status": "healthy",
                "service": "vae-python-backend",
                "port": PORT,
                "evidence_store": str(STORE_PATH),
                "total_evidence_stored": item_count,
            }
            self.wfile.write(json.dumps(res).encode("utf-8"))
            return

        if path.startswith("/v1/sessions/"):
            session_id = path[len("/v1/sessions/"):]
            if not session_id:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "session_id required"}).encode("utf-8"))
                return

            evidence_items = []
            if STORE_PATH.exists():
                with STORE_PATH.open("r", encoding="utf-8") as f:
                    for line in f:
                        try:
                            record = json.loads(line)
                            if record.get("session_id") == session_id:
                                evidence_items.append(record)
                        except json.JSONDecodeError:
                            continue

            self._set_headers(200)
            self.wfile.write(json.dumps({
                "session_id": session_id,
                "count": len(evidence_items),
                "evidence": evidence_items,
            }).encode("utf-8"))
            return

        self._set_headers(404)
        self.wfile.write(json.dumps({"error": "not found", "path": path}).encode("utf-8"))

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length > 0 else b"{}"

        try:
            payload = json.loads(body.decode("utf-8")) if body else {}
        except json.JSONDecodeError:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "invalid json payload"}).encode("utf-8"))
            return

        if path in ("/v1/ingest", "/v1/evidence/ingest"):
            # Simple direct append to store
            if not isinstance(payload, dict) or "session_id" not in payload:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "session_id required"}).encode("utf-8"))
                return

            with STORE_PATH.open("a", encoding="utf-8") as f:
                f.write(json.dumps(payload) + "\n")

            self._set_headers(201)
            self.wfile.write(json.dumps({
                "status": "ingested",
                "session_id": payload["session_id"],
                "evidence_id": payload.get("evidence_id"),
            }).encode("utf-8"))
            return

        if path == "/v1/prototype-run":
            if prototype_ingest:
                session_id = payload.get("session_id", "urn:vap:session:api-trigger")
                source_id = payload.get("source_id", "python-backend-runner")
                observations = prototype_ingest.create_mock_observations(session_id, source_id, 10)
                valid_obs = [o for o in observations if prototype_ingest.validate_observation(o)[0]]
                store = prototype_ingest.EvidenceStore(str(STORE_PATH))
                created = []
                for ev_type in ["E-INTERACTION", "E-VISIBLE", "E-DURATION", "E-CONTEXT"]:
                    ev = prototype_ingest.create_evidence_from_observations(
                        session_id, source_id, valid_obs, ev_type, confidence=0.88
                    )
                    store.append(ev)
                    created.append(ev.evidence_id)

                self._set_headers(200)
                self.wfile.write(json.dumps({
                    "status": "completed",
                    "session_id": session_id,
                    "evidence_created": created,
                }).encode("utf-8"))
                return
            else:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": "prototype_ingest module unavailable"}).encode("utf-8"))
                return

        self._set_headers(404)
        self.wfile.write(json.dumps({"error": "not found", "path": path}).encode("utf-8"))

    def log_message(self, format, *args):
        # Override standard log to output timestamped clean logs
        sys.stderr.write(f"[python-backend] {self.address_string()} - {format % args}\n")


def run_server():
    server = HTTPServer((HOST, PORT), VapHttpHandler)
    print("=============================================================")
    print("🐍 Verified Attention Python Ingestion & Analytics Server")
    print(f"🌐 Listening on http://{HOST}:{PORT}")
    print(f"📁 Evidence store: {STORE_PATH}")
    print("=============================================================")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[python-backend] Shutting down...")
        server.server_close()


if __name__ == "__main__":
    run_server()
