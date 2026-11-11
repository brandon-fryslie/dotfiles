"""How the codex imagegen batch retries a rate-limited job: against a local stand-in for the
Image API, --max-attempts bounds the requests sent, the server's retry-after-ms is waited
out, and every retry is reported on stderr.

Run: just test-image-gen
"""

import base64
import json
import os
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "config/codex/skills/imagegen/scripts/image_gen.py"
IMAGE = b"\x89PNG\r\n\x1a\n-stand-in-bytes"


class ImageApi(BaseHTTPRequestHandler):
    """Answers POST /v1/images/generations from `statuses`, one status per request."""

    statuses: list = []
    requests = 0

    def do_POST(self):
        self.rfile.read(int(self.headers["Content-Length"]))
        status = type(self).statuses[type(self).requests]
        type(self).requests += 1
        if status == 429:
            body = {"error": {"message": "Rate limit reached", "type": "requests", "code": "rate_limit_exceeded"}}
        else:
            body = {"created": 0, "data": [{"b64_json": base64.b64encode(IMAGE).decode()}]}
        raw = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("retry-after-ms", "10")
        self.end_headers()
        self.wfile.write(raw)

    def log_message(self, *args):
        pass


class BatchRetryTest(unittest.TestCase):
    def run_batch(self, statuses, max_attempts):
        ImageApi.statuses = statuses
        ImageApi.requests = 0
        server = ThreadingHTTPServer(("127.0.0.1", 0), ImageApi)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        out = Path(tempfile.mkdtemp())
        jobs = out / "jobs.jsonl"
        jobs.write_text('{"prompt": "a red cube", "out": "cube.png"}\n')
        env = dict(
            os.environ,
            OPENAI_API_KEY="test-key",
            OPENAI_BASE_URL=f"http://127.0.0.1:{server.server_port}/v1",
        )
        proc = subprocess.run(
            [sys.executable, str(SCRIPT), "generate-batch", "--input", str(jobs), "--out-dir", str(out),
             "--no-augment", "--max-attempts", str(max_attempts)],
            env=env, capture_output=True, text=True, timeout=60,
        )
        return proc, out / "cube.png"

    def test_rate_limited_then_served(self):
        proc, image = self.run_batch([429, 200], max_attempts=3)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(ImageApi.requests, 2)
        self.assertEqual(image.read_bytes(), IMAGE)
        self.assertIn("Retrying request in 0.010000 seconds (retry 1 of 2)", proc.stderr)

    def test_max_attempts_bounds_requests(self):
        proc, image = self.run_batch([429, 429, 429], max_attempts=2)
        self.assertEqual(proc.returncode, 1, proc.stderr)
        self.assertEqual(ImageApi.requests, 2)
        self.assertFalse(image.exists())
        self.assertIn("[job 1/1] failed", proc.stderr)

    def test_one_attempt_never_retries(self):
        proc, _ = self.run_batch([429], max_attempts=1)
        self.assertEqual(proc.returncode, 1, proc.stderr)
        self.assertEqual(ImageApi.requests, 1)
        self.assertNotIn("Retrying", proc.stderr)


if __name__ == "__main__":
    unittest.main()
