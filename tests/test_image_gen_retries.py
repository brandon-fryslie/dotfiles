"""How the codex imagegen batch retries a rate-limited job: against a local stand-in for the
Image API, --max-attempts bounds the requests sent, the server's retry-after-ms is waited
out, and the job reports how many retries it took.

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


class ImageApi(ThreadingHTTPServer):
    """Answers POST /v1/images/generations from `statuses`, one per request; the last repeats."""

    def __init__(self, statuses):
        super().__init__(("127.0.0.1", 0), ImageApiHandler)
        self.statuses = statuses
        self.requests = 0


class ImageApiHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.rfile.read(int(self.headers["Content-Length"]))
        api = self.server
        status = api.statuses[min(api.requests, len(api.statuses) - 1)]
        api.requests += 1
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
        api = ImageApi(statuses)
        threading.Thread(target=api.serve_forever, daemon=True).start()
        self.addCleanup(api.server_close)
        self.addCleanup(api.shutdown)
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        out = Path(tmp.name)
        jobs = out / "jobs.jsonl"
        jobs.write_text('{"prompt": "a red cube", "out": "cube.png"}\n')
        # Only what the script needs: no OPENAI_LOG or org settings from the caller's shell, and
        # NO_PROXY so neither a proxy variable nor a macOS system proxy reroutes 127.0.0.1.
        env = {
            "PATH": os.environ["PATH"],
            "NO_PROXY": "*",
            "OPENAI_API_KEY": "test-key",
            "OPENAI_BASE_URL": f"http://127.0.0.1:{api.server_port}/v1",
        }
        proc = subprocess.run(
            [sys.executable, str(SCRIPT), "generate-batch", "--input", str(jobs), "--out-dir", str(out),
             "--no-augment", "--max-attempts", str(max_attempts)],
            env=env, capture_output=True, text=True, timeout=60,
        )
        return proc, api.requests, out / "cube.png"

    def test_rate_limited_then_served(self):
        proc, requests, image = self.run_batch([429, 200], max_attempts=3)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertEqual(requests, 2)
        self.assertEqual(image.read_bytes(), IMAGE)
        self.assertRegex(proc.stderr, r"\[job 1/1\] completed in \S+s after 1 retries")

    def test_max_attempts_bounds_requests(self):
        proc, requests, image = self.run_batch([429], max_attempts=2)
        self.assertEqual(proc.returncode, 1, proc.stderr)
        self.assertEqual(requests, 2)
        self.assertFalse(image.exists())
        self.assertIn("[job 1/1] failed", proc.stderr)

    def test_one_attempt_never_retries(self):
        proc, requests, _ = self.run_batch([429], max_attempts=1)
        self.assertEqual(proc.returncode, 1, proc.stderr)
        self.assertEqual(requests, 1)


if __name__ == "__main__":
    unittest.main()
