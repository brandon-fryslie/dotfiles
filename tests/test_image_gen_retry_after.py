"""How long the codex imagegen script waits before retrying: a retry_after attribute on the
error wins, otherwise the Retry-After value in the error message, fractional seconds included.

Run: just test-image-gen
"""

import sys
import unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent / "config/codex/skills/imagegen/scripts"
sys.path.insert(0, str(SCRIPTS))
sys.dont_write_bytecode = True  # importing must not drop __pycache__ into the linked ~/.codex skill
from image_gen import _extract_retry_after_seconds  # noqa: E402


class RetryAfterTest(unittest.TestCase):
    def test_fractional_seconds(self):
        self.assertEqual(_extract_retry_after_seconds(Exception("Retry-After: 2.5")), 2.5)

    def test_fractional_below_one_second(self):
        self.assertEqual(_extract_retry_after_seconds(Exception("retry-after: 0.8")), 0.8)

    def test_whole_seconds(self):
        self.assertEqual(_extract_retry_after_seconds(Exception("Rate limited. Retry after 7")), 7.0)

    def test_attribute_wins_over_message(self):
        exc = Exception("Retry-After: 2.5")
        exc.retry_after = 3
        self.assertEqual(_extract_retry_after_seconds(exc), 3.0)

    def test_no_value(self):
        self.assertIsNone(_extract_retry_after_seconds(Exception("429 Too Many Requests")))


if __name__ == "__main__":
    unittest.main()
