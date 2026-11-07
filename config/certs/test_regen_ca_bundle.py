"""select_anchors decides which certs enter the bundle; the probes are injected.
inspect_cert and macos_trusts are the real probes, exercised against certs
generated here with the local openssl and checked by the real macOS evaluator.

Run: just test-certs
"""
import importlib.util
import subprocess
import tempfile
import unittest
from unittest import mock
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


REVOCATION_INFO = """\
    RevocationInfo =     (
                {
            valid =             {
                checkOCSP = 0;
                valid = 0;
            };
        }
    );
"""


def entry(*failed):
    checks = "".join(f"            {name} = 0;\n" for name in failed)
    codes = '            StatusCodes =             (\n                "-2147408889"\n            );\n'
    return "                {\n" + checks + (codes if failed else "") + "        }"


def verify_cert_v(value, *entries, revocation=""):
    """The stderr `security verify-cert -v` prints, in the shape captured on macOS 26."""
    return ("---\nTrust evaluation results\n{\n" + revocation
            + '    TrustEvaluationDate = "2026-11-07 09:09:07 +0000";\n'
            + "    TrustResultDetails =     (\n" + ",\n".join(entries or (entry(),)) + "\n    );\n"
            + f"    TrustResultValue = {value};\n}}\n")


# Shapes as (exit code, stderr), measured live on u2 (macOS 26) except as
# noted (ticket dotfiles-unfiled-25bc.4q1).
ACCEPTED = (0, verify_cert_v(4))
PROCEED = (0, verify_cert_v(1))
# Not yet observed: value 3 is SecTrust.h's kSecTrustResultDeny, pending
# ticket dotfiles-unfiled-25bc.vdj.
DENY = (1, verify_cert_v(3, entry()))
NOBODY_TRUSTED = (1, verify_cert_v(5, entry("AnchorTrusted")))
APPLE_PLATFORM_ROOT = (1, verify_cert_v(
    5, entry("AnchorTrusted", "OtherTrustValidityPeriod", "ServerAuthEKU")))
ISRG_ROOT_X1 = (1, verify_cert_v(5, entry("ServerAuthEKU")))
DIGICERT_TLS_G5 = (1, verify_cert_v(5, entry(
    "OtherTrustValidityPeriod", "ServerAuthEKU", "SystemTrustValidityPeriod",
    "SystemTrustedCTRequired"), revocation=REVOCATION_INFO))
# Visa Information Delivery Root CA on studious (macOS 15.0.1): StatusCodes
# sits between the failed checks.
EXPIRED = (1, verify_cert_v(5, """\
                {
            ServerAuthEKU = 0;
            StatusCodes =             (
                "-2147409654",
                "-2147408889"
            );
            TemporalValidity = 0;
        }"""))


def verify_cert_per_policy(answers):
    """The run seam answering verify-cert by its -p policy; records the policies asked."""
    asked = []

    def fake(cmd, **kw):
        if cmd[0] != "security":  # the die message's openssl subject lookup
            return subprocess.CompletedProcess(cmd, 1, stdout="", stderr="")
        policy = cmd[cmd.index("-p") + 1]
        asked.append(policy)
        rc, stderr = answers[policy]
        return subprocess.CompletedProcess(cmd, rc, stdout="", stderr=stderr)
    return mock.patch.object(regen, "run", side_effect=fake), asked


class MacosTrusts(unittest.TestCase):
    """ssl's anchor answer decides; a Deny under either policy leaves the cert out."""

    def trusts(self, basic=ACCEPTED, ssl=ACCEPTED):
        patch, asked = verify_cert_per_policy({"basic": basic, "ssl": ssl})
        with patch:
            trusted = regen.macos_trusts("pem")
        self.assertEqual(sorted(asked), ["basic", "ssl"])
        return trusted

    def dies(self, **answers):
        with self.assertRaises(SystemExit) as died:
            self.trusts(**answers)
        return str(died.exception.code)

    def test_a_root_ssl_refuses_only_as_a_server_leaf_is_trusted(self):
        for ssl in (ISRG_ROOT_X1, DIGICERT_TLS_G5):
            with self.subTest(ssl=ssl):
                self.assertTrue(self.trusts(ssl=ssl))

    def test_a_root_not_trusted_as_an_ssl_anchor_is_left_out_though_basic_accepts_it(self):
        self.assertFalse(self.trusts(ssl=APPLE_PLATFORM_ROOT))

    def test_anchor_refusal_on_any_chain_cert_leaves_it_out(self):
        two_cert_chain = (1, verify_cert_v(5, entry("ServerAuthEKU"), entry("AnchorTrusted")))
        self.assertFalse(self.trusts(ssl=two_cert_chain))

    def test_ca_trusted_by_a_trust_setting_is_trusted(self):
        self.assertTrue(self.trusts(basic=PROCEED, ssl=PROCEED))

    def test_ca_nobody_trusted_is_left_out(self):
        self.assertFalse(self.trusts(basic=NOBODY_TRUSTED, ssl=NOBODY_TRUSTED))

    def test_expired_is_left_out(self):
        self.assertFalse(self.trusts(basic=EXPIRED, ssl=EXPIRED))

    def test_a_deny_under_either_policy_leaves_it_out(self):
        self.assertFalse(self.trusts(basic=DENY, ssl=ISRG_ROOT_X1))
        self.assertFalse(self.trusts(basic=ACCEPTED, ssl=DENY))

    def test_a_failed_check_not_known_to_be_noise_is_an_error(self):
        self.assertIn("SignatureHashAlgorithms",
                      self.dies(ssl=(1, verify_cert_v(5, entry("SignatureHashAlgorithms")))))

    def test_a_basic_run_that_did_not_evaluate_is_an_error_not_an_absent_deny(self):
        for basic in ((1, verify_cert_v(7)), (1, verify_cert_v(6)), (1, "garbage\n")):
            with self.subTest(basic=basic):
                self.assertIn("-p basic", self.dies(basic=basic, ssl=ISRG_ROOT_X1))

    def test_an_ssl_run_that_did_not_evaluate_is_an_error(self):
        for ssl in ((1, verify_cert_v(7)), (1, verify_cert_v(6)), (1, "")):
            with self.subTest(ssl=ssl):
                self.assertIn("-p ssl", self.dies(ssl=ssl))

    def test_a_details_line_of_unknown_shape_is_an_error_not_skipped(self):
        for line in ('            "AnchorTrusted" = 0;', "            AnchorTrusted = 1;",
                     "              AnchorTrusted = 0;"):
            with self.subTest(line=line):
                hidden = "                {\n" + line + "\n            ServerAuthEKU = 0;\n        }"
                self.assertIn("-p ssl", self.dies(ssl=(1, verify_cert_v(5, hidden))))

    def test_failed_checks_contradicting_the_result_are_an_error(self):
        self.assertIn("-p ssl", self.dies(ssl=(0, verify_cert_v(4, entry("AnchorTrusted")))))
        self.assertIn("-p ssl", self.dies(ssl=(1, verify_cert_v(5, entry()))))

    def test_an_exit_code_contradicting_the_result_is_an_error(self):
        self.assertIn("-p ssl", self.dies(ssl=(1, verify_cert_v(4))))
        self.assertIn("-p ssl", self.dies(ssl=(0, verify_cert_v(5, entry("ServerAuthEKU")))))
        self.assertIn("-p basic", self.dies(basic=(0, verify_cert_v(3))))


def openssl(*args):
    subprocess.run(["openssl", *args], check=True, capture_output=True)


def system_root(name):
    """The root's PEM, or "" when this macOS does not ship it."""
    r = subprocess.run(["security", "find-certificate", "-c", name, "-p",
                        "/System/Library/Keychains/SystemRootCertificates.keychain"],
                       capture_output=True, text=True)
    if r.returncode != 0 and "could not be found" not in r.stderr:
        raise RuntimeError(f"security find-certificate -c {name!r}: {r.stderr.strip()}")
    return r.stdout


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
        openssl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", d / "nameless.key",
                "-out", d / "nameless.pem", "-subj", "/", "-days", "2",
                "-addext", "basicConstraints=critical,CA:TRUE")
        cls.pem = {n: (d / f"{n}.pem").read_text()
                   for n in ("root", "intermediate", "leaf", "nameless")}

    @classmethod
    def tearDownClass(cls):
        cls._tmp.cleanup()

    def test_inspect_classifies_root_intermediate_and_leaf(self):
        self.assertEqual(regen.inspect_cert(self.pem["root"]), (True, True))
        self.assertEqual(regen.inspect_cert(self.pem["intermediate"]), (True, False))
        self.assertEqual(regen.inspect_cert(self.pem["leaf"]), (False, False))

    def test_inspect_rejects_what_openssl_cannot_read(self):
        self.assertIsNone(regen.inspect_cert("not a certificate\n"))

    def test_inspect_does_not_call_a_ca_with_empty_names_self_issued(self):
        self.assertEqual(regen.inspect_cert(self.pem["nameless"]), (True, False))

    def test_macos_does_not_trust_a_root_nobody_trusted(self):
        self.assertFalse(regen.macos_trusts(self.pem["root"]))

    def test_macos_trusts_a_tls_root_ssl_refuses_only_as_a_server_leaf(self):
        isrg = system_root("ISRG Root X1")
        with tempfile.NamedTemporaryFile("w", suffix=".pem") as fh:
            fh.write(isrg)
            fh.flush()
            self.assertEqual(regen.evaluate(fh.name, "ssl"),
                             regen.Evaluated(frozenset({"ServerAuthEKU"})))
        self.assertTrue(regen.macos_trusts(isrg))

    def test_macos_does_not_trust_an_apple_platform_root_for_tls(self):
        root = system_root("Apple Platform RSA Root CA - G1")
        if not root:
            self.skipTest("this macOS has no Apple Platform roots (macOS 15 does not)")
        self.assertFalse(regen.macos_trusts(root))

    def test_macos_failing_to_evaluate_is_an_error_not_a_verdict(self):
        with self.assertRaises(SystemExit):
            regen.macos_trusts("not a certificate\n")


if __name__ == "__main__":
    unittest.main()
