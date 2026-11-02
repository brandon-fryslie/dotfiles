"""select_anchors decides which certs enter the bundle; the probes are injected.

Run: just test-certs
"""
import importlib.util
import unittest
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "regen_ca_bundle", Path(__file__).with_name("regen-ca-bundle.py"))
regen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(regen)

# name -> (is_ca, self_issued); a cert's "pem" is just its name.
KINDS = {
    "root": (True, True),
    "untrusted-root": (True, True),
    "intermediate": (True, False),
    "leaf": (False, False),
    "self-signed-leaf": (False, True),
}
TRUSTED = {"root", "intermediate", "leaf", "self-signed-leaf"}


def select(pems):
    return regen.select_anchors(pems, KINDS.get, lambda p: p in TRUSTED)


class SelectAnchors(unittest.TestCase):
    def test_trusted_self_issued_ca_is_an_anchor(self):
        self.assertEqual(select(["root"]), (["root"], []))

    def test_ca_with_no_trust_is_dropped_and_reported(self):
        self.assertEqual(select(["untrusted-root"]),
                         ([], [("untrusted-root", "not trusted by macOS")]))

    def test_intermediate_is_dropped_even_though_macos_accepts_it(self):
        self.assertEqual(select(["intermediate"]), ([], [("intermediate", "intermediate")]))

    def test_non_ca_certs_are_neither_kept_nor_reported(self):
        self.assertEqual(select(["leaf", "self-signed-leaf"]), ([], []))

    def test_unparseable_cert_is_skipped(self):
        self.assertEqual(select(["garbage"]), ([], []))

    def test_order_is_preserved(self):
        self.assertEqual(select(["untrusted-root", "root", "leaf"])[0], ["root"])


if __name__ == "__main__":
    unittest.main()
