"""select_anchors decides which certs enter the bundle; the probes are injected.
inspect_cert and macos_trusts are the real probes, exercised against certs
generated here with the local openssl and checked by the real macOS evaluator.

Run: just test-certs
"""
import importlib.util
import subprocess
import tempfile
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

    def test_unreadable_cert_is_dropped_and_reported(self):
        self.assertEqual(select(["garbage"]), ([], [("garbage", "unreadable by openssl")]))

    def test_order_is_preserved(self):
        self.assertEqual(select(["untrusted-root", "root", "leaf"])[0], ["root"])


def openssl(*args):
    subprocess.run(["openssl", *args], check=True, capture_output=True)


class RealCerts(unittest.TestCase):
    """A root, an intermediate it signed, and a leaf, none known to macOS."""

    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory()
        d = Path(cls._tmp.name)
        openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", d / "root.key",
                "-out", d / "root.pem", "-subj", "/CN=test-root", "-days", "2",
                "-addext", "basicConstraints=critical,CA:TRUE")
        for name, ca in (("intermediate", "TRUE"), ("leaf", "FALSE")):
            (d / f"{name}.ext").write_text(f"basicConstraints=CA:{ca}\n")
            openssl("req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", d / f"{name}.key",
                    "-out", d / f"{name}.csr", "-subj", f"/CN=test-{name}")
            openssl("x509", "-req", "-in", d / f"{name}.csr", "-CA", d / "root.pem",
                    "-CAkey", d / "root.key", "-CAcreateserial", "-out", d / f"{name}.pem",
                    "-days", "2", "-extfile", d / f"{name}.ext")
        cls.pem = {n: (d / f"{n}.pem").read_text() for n in ("root", "intermediate", "leaf")}

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

    def test_inspect_classifies_root_intermediate_and_leaf(self):
        self.assertEqual(regen.inspect_cert(self.pem["root"]), (True, True))
        self.assertEqual(regen.inspect_cert(self.pem["intermediate"]), (True, False))
        self.assertEqual(regen.inspect_cert(self.pem["leaf"]), (False, False))

    def test_inspect_rejects_what_openssl_cannot_read(self):
        self.assertIsNone(regen.inspect_cert("not a certificate\n"))

    def test_macos_does_not_trust_a_root_nobody_trusted(self):
        self.assertFalse(regen.macos_trusts(self.pem["root"]))

    def test_macos_failing_to_evaluate_is_an_error_not_a_verdict(self):
        with self.assertRaises(SystemExit):
            regen.macos_trusts("not a certificate\n")


if __name__ == "__main__":
    unittest.main()
