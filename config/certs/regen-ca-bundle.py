#!/usr/bin/env python3
"""Derive the combined CA bundle from the macOS system trust store + Proxyman CA.

SSL_CERT_FILE and REQUESTS_CA_BUNDLE *replace* the trust store (unlike
NODE_EXTRA_CA_CERTS, which adds to it), so whatever they point at must be
complete on its own. This builds that file from the machine's own keychains
rather than from a packaged Mozilla snapshot, so it reflects the roots this Mac
actually trusts -- including anything admin-installed. Only self-issued CAs that
macOS's own evaluator trusts are included: a CA that merely sits in a keychain
with no trust setting, a distrusted root, and intermediates are left out.

[LAW:one-source-of-truth] The keychain is the authority; this output is derived.
Never hand-edit it. Re-run after adding a root or regenerating the Proxyman CA.

Re-run:  ~/.config/certs/regen-ca-bundle.py
"""
import plistlib
import re
import shlex
import subprocess
import tempfile
import time
import sys
from pathlib import Path

CERTS = Path.home() / ".config/certs"
PROXYMAN_CA = CERTS / "proxyman-ca.pem"
OUT = CERTS / "ca-bundle-with-proxyman.pem"

LAUNCH_AGENT = Path.home() / "Library/LaunchAgents/local.ca-env.plist"
LAUNCH_LABEL = "local.ca-env"
ENV_SH = CERTS / "env.sh"

# The one declaration of what each variable points at. Everything that sets
# these -- the launchd agent for GUI apps, the shell fragment for ssh sessions --
# is rendered from this table, so the two can never drift apart.
# [LAW:one-source-of-truth]
#
# Every variable points at the one keychain-derived bundle, so all runtimes trust
# the same set. NODE_EXTRA_CA_CERTS adds to Node's bundled
# Mozilla roots; given the Proxyman CA alone, Node would miss admin-installed and
# local roots (e.g. Caddy's). Node's own --use-system-ca is not usable instead: on
# Node 26 it lists the keychain CAs and still rejects their chains.
# SSL_CERT_FILE and REQUESTS_CA_BUNDLE REPLACE the trust store, so they need the
# full bundle regardless.
# uv ships its own root list and ignores the keychain unless UV_SYSTEM_CERTS is
# set, so without it every uv fetch through Proxyman fails with UnknownIssuer.
TRUST_ENV = {
    "NODE_EXTRA_CA_CERTS": OUT,
    "SSL_CERT_FILE": OUT,
    "REQUESTS_CA_BUNDLE": OUT,
    "UV_SYSTEM_CERTS": "1",
}

KEYCHAINS = [
    Path("/System/Library/Keychains/SystemRootCertificates.keychain"),  # Apple roots
    Path("/Library/Keychains/System.keychain"),                         # admin-installed
    Path.home() / "Library/Keychains/login.keychain-db",                # user-added
]

PEM_RE = re.compile(r"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", re.S)


def die(msg):
    sys.exit(f"ERROR: {msg}")


def run(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def inspect_cert(pem):
    """Parse a cert into (is_ca, is_self_issued), or None if openssl cannot read it.

    The login keychain holds personal leaf certs alongside roots; a leaf in a
    trust bundle means that exact certificate is trusted directly, which is not
    what a CA bundle is for. Parsing each cert and keeping only CA:TRUE makes
    the output's type real instead of asserted. [LAW:parse-dont-validate]

    Self-issued (subject == issuer) is what makes a CA a trust anchor rather
    than an intermediate that only chains up to one.
    """
    r = run(["openssl", "x509", "-noout", "-text", "-subject", "-issuer",
             "-nameopt", "RFC2253"], input=pem)
    if r.returncode != 0:
        return None
    names = {k: v for k, _, v in (l.partition("=") for l in r.stdout.splitlines()
                                  if l.startswith(("subject=", "issuer=")))}
    if "subject" not in names or "issuer" not in names:
        return None  # absent names must not compare equal and read as self-issued
    return "CA:TRUE" in r.stdout, names["subject"] == names["issuer"]


# verify-cert prints one of these on stderr whenever the evaluator reached a
# verdict. An explicit Deny trust entry gets the second form, not the first.
# Only Deny is listed: any other shape is not known to be a verdict.
VERDICT_RE = re.compile(
    r"^(?:Cert Verify Result: \S+|SecTrustEvaluate result: kSecTrustResultDeny)$", re.M)


def macos_trusts(pem):
    """True when macOS's own evaluator accepts the cert -- the one source of truth.

    `-p basic` evaluates trust without the ssl policy's leaf-only extended-key-
    usage rule, which rejects every root. The evaluator folds in the system
    roots, admin and user trust settings, and explicit Deny entries, so a cert
    that merely sits in a keychain (no trust setting) or was distrusted fails.
    [LAW:one-source-of-truth]

    A non-zero exit alone does not mean "untrusted": it is also what an
    unreadable file or a failed keychain access returns. Only a printed verdict
    is an answer; anything else dies rather than dropping the cert unseen.
    [LAW:no-silent-failure]
    """
    with tempfile.NamedTemporaryFile("w", suffix=".pem") as fh:
        fh.write(pem)
        fh.flush()
        r = run(["security", "verify-cert", "-c", fh.name, "-p", "basic"])
    if r.returncode == 0:
        return True
    if VERDICT_RE.search(r.stderr):
        return False
    die(f"security verify-cert could not evaluate a certificate: "
        f"{r.stderr.strip() or r.stdout.strip() or 'no output'}")


def subject(pem):
    r = run(["openssl", "x509", "-noout", "-subject"], input=pem)
    return r.stdout.strip() if r.returncode == 0 else "<unparseable>"


def select_anchors(pems, inspect, trusts):
    """Pick the trust anchors out of `pems`; return (anchors, dropped).

    An anchor is a self-issued CA that macOS trusts. Intermediates are excluded
    even though macOS accepts them: they verify only because a root above them is
    trusted, and that root is in the bundle itself. `dropped` is [(pem, why)] for
    CA certs left out, plus any cert openssl cannot read, so the run shows what
    it refused. Non-CA certs (leaf identities) are not candidates and are not
    reported.
    """
    anchors, dropped = [], []
    for pem in pems:
        parsed = inspect(pem)
        if parsed is None:
            dropped.append((pem, "unreadable by openssl"))
            continue
        is_ca, self_issued = parsed
        if not is_ca:
            continue
        if not self_issued:
            dropped.append((pem, "intermediate"))
        elif not trusts(pem):
            dropped.append((pem, "not trusted by macOS"))
        else:
            anchors.append(pem)
    return anchors, dropped


def read_source(path):
    if not path.exists():
        die(f"missing source: {path}")
    if path.suffix == ".pem":
        text = path.read_text()
    else:
        r = run(["security", "find-certificate", "-a", "-p", str(path)])
        if r.returncode != 0:
            die(f"could not read keychain {path}: {r.stderr.strip()}")
        text = r.stdout
    found = [pem + "\n" for pem in PEM_RE.findall(text)]
    if not found:
        die(f"no certificates found in {path}")
    return found


def collect():
    """Return (anchors, dropped, stats); stats maps source name -> (found, kept)."""
    out, dropped, stats, seen = [], [], {}, set()
    sources = [(kc.name, kc) for kc in KEYCHAINS] + [("proxyman-ca.pem", PROXYMAN_CA)]
    for name, path in sources:
        found = read_source(path)
        # A cert present in several sources is judged once, at its first source.
        fresh = [p for p in dict.fromkeys(found) if p not in seen]
        seen.update(fresh)
        anchors, rejected = select_anchors(fresh, inspect_cert, macos_trusts)
        out += anchors
        dropped += rejected
        stats[name] = (len(found), len(anchors))
    return out, dropped, stats


def write_launch_agent():
    """Render the launchd agent that sets these for GUI-launched processes.

    `launchctl setenv A x B y` exits 0 and silently sets nothing, so each
    variable needs its own invocation. plistlib writes the XML so the paths are
    escaped correctly rather than hand-interpolated.
    """
    script = "; ".join(
        f"launchctl setenv {k} {shlex.quote(str(v))}" for k, v in TRUST_ENV.items()
    )
    LAUNCH_AGENT.parent.mkdir(parents=True, exist_ok=True)
    with LAUNCH_AGENT.open("wb") as fh:
        plistlib.dump({
            "Label": LAUNCH_LABEL,
            "ProgramArguments": ["/bin/sh", "-c", script],
            "RunAtLoad": True,
        }, fh)
    return LAUNCH_AGENT


def write_env_sh():
    """Render the trust env for shells, sourced by config/shellenv.global.

    The launchd agent only reaches processes in the GUI session; an ssh session
    is bootstrapped outside it and would otherwise get no trust configuration.
    """
    body = "".join(f'export {k}="{v}"\n' for k, v in TRUST_ENV.items())
    ENV_SH.write_text(
        "# Generated by regen-ca-bundle.py -- do not edit.\n"
        "# Sourced by every zsh and interactive/login bash via config/shellenv.global.\n"
        + body
    )
    return ENV_SH


def reload_launch_agent():
    uid = subprocess.run(["id", "-u"], capture_output=True, text=True).stdout.strip()
    domain = f"gui/{uid}"
    run(["launchctl", "bootout", f"{domain}/{LAUNCH_LABEL}"])  # may not be loaded
    r = run(["launchctl", "bootstrap", domain, str(LAUNCH_AGENT)])
    if r.returncode != 0:
        die(f"could not bootstrap {LAUNCH_LABEL}: {r.stderr.strip() or r.stdout.strip()}")
    # Verify the domain actually took every variable, rather than trusting exit 0.
    # bootstrap returns before RunAtLoad has finished, so wait for the condition
    # itself with a deadline instead of assuming it is already true.
    # [LAW:no-ambient-temporal-coupling]
    deadline = time.monotonic() + 10
    missing = list(TRUST_ENV)
    while time.monotonic() < deadline:
        printed = run(["launchctl", "print", domain]).stdout
        missing = [k for k, v in TRUST_ENV.items() if f"{k} => {v}" not in printed]
        if not missing:
            return domain
        time.sleep(0.25)
    die(f"launchd domain {domain} still missing after 10s: {missing}")


def main():
    certs, dropped, stats = collect()

    proxyman = [c for c in certs if "Proxyman LLC" in subject(c)]
    if not proxyman:
        die("Proxyman CA absent from the assembled bundle: it is missing, or macOS does "
            "not trust it (trust it in Keychain Access, then re-run)")
    if len(certs) < 100:
        die(f"only {len(certs)} CA certs assembled; refusing to publish a truncated trust store")

    OUT.write_text("".join(certs))
    OUT.chmod(0o644)

    for name, (found, kept) in stats.items():
        print(f"  {name:38} {found:4} certs -> {kept:3} new anchors")
    for pem, why in dropped:
        print(f"  left out ({why}): {subject(pem)}")
    print(f"wrote {OUT} ({len(certs)} CA certs, Proxyman CA included)")

    print(f"wrote {write_env_sh()}")
    print(f"wrote {write_launch_agent()}")
    print(f"reloaded {LAUNCH_LABEL} in {reload_launch_agent()}; all {len(TRUST_ENV)} vars verified present")


if __name__ == "__main__":
    main()
