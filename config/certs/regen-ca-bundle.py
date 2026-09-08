#!/usr/bin/env python3
"""Derive the combined CA bundle from the macOS system trust store + Proxyman CA.

SSL_CERT_FILE and REQUESTS_CA_BUNDLE *replace* the trust store (unlike
NODE_EXTRA_CA_CERTS, which adds to it), so whatever they point at must be
complete on its own. This builds that file from the machine's own keychains
rather than from a packaged Mozilla snapshot, so it reflects the roots this Mac
actually trusts -- including anything admin-installed.

[LAW:one-source-of-truth] The keychain is the authority; this output is derived.
Never hand-edit it. Re-run after adding a root or regenerating the Proxyman CA.

Re-run:  ~/.config/certs/regen-ca-bundle.py
"""
import hashlib
import plistlib
import re
import shlex
import subprocess
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
# NODE_EXTRA_CA_CERTS ADDS to the trust store, so it takes the Proxyman CA alone.
# SSL_CERT_FILE and REQUESTS_CA_BUNDLE REPLACE it, so they need the full bundle.
TRUST_ENV = {
    "NODE_EXTRA_CA_CERTS": PROXYMAN_CA,
    "SSL_CERT_FILE": OUT,
    "REQUESTS_CA_BUNDLE": OUT,
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


def assert_no_distrust():
    """Abort if any cert is explicitly denied.

    Deny entries would have to be filtered out of the bundle, or we would
    re-trust a root the user deliberately distrusted. This machine currently has
    zero, so rather than ship an untested filter path we fail loudly and leave
    the decision visible. [LAW:no-silent-failure]
    """
    for label, flag in (("system", "-s"), ("admin", "-d"), ("user", None)):
        tmp = Path(f"/tmp/trust-settings-{label}.plist")
        cmd = ["security", "trust-settings-export"] + ([flag] if flag else []) + [str(tmp)]
        if run(cmd).returncode != 0 or not tmp.exists():
            continue
        try:
            settings = plistlib.loads(tmp.read_bytes()).get("trustList", {})
        finally:
            tmp.unlink(missing_ok=True)
        denied = [
            h for h, e in settings.items()
            for s in (e.get("trustSettings") or [{}])
            if s.get("kSecTrustSettingsResult") == 3  # kSecTrustSettingsResultDeny
        ]
        if denied:
            die(f"{label} domain explicitly distrusts {len(denied)} cert(s): {denied}. "
                "Filter these out before regenerating, or the bundle re-trusts them.")


def is_ca(pem):
    """True only for real CA certs.

    The login keychain holds personal leaf certs alongside roots; a leaf in a
    trust bundle means that exact certificate is trusted directly, which is not
    what a CA bundle is for. Parsing each cert and keeping only CA:TRUE makes
    the output's type real instead of asserted. [LAW:parse-dont-validate]
    """
    r = run(["openssl", "x509", "-noout", "-text"], input=pem)
    return r.returncode == 0 and "CA:TRUE" in r.stdout


def subject(pem):
    r = run(["openssl", "x509", "-noout", "-subject"], input=pem)
    return r.stdout.strip() if r.returncode == 0 else "<unparseable>"


def collect():
    seen, out, stats = set(), [], {}
    sources = [(kc.name, kc) for kc in KEYCHAINS] + [("proxyman-ca.pem", PROXYMAN_CA)]
    for name, path in sources:
        if not path.exists():
            die(f"missing source: {path}")
        if path.suffix == ".pem":
            text = path.read_text()
        else:
            r = run(["security", "find-certificate", "-a", "-p", str(path)])
            if r.returncode != 0:
                die(f"could not read keychain {path}: {r.stderr.strip()}")
            text = r.stdout
        found = PEM_RE.findall(text)
        if not found:
            die(f"no certificates found in {path}")
        kept = 0
        for pem in found:
            pem += "\n"
            if not is_ca(pem):
                continue
            fp = hashlib.sha256(pem.encode()).hexdigest()
            if fp in seen:
                continue
            seen.add(fp)
            out.append(pem)
            kept += 1
        stats[name] = (len(found), kept)
    return out, stats


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
    """Render the shell fallback.

    The launchd agent only reaches processes in the GUI session; an ssh session
    is bootstrapped outside it and would otherwise get no trust configuration.
    """
    body = "".join(f'export {k}="{v}"\n' for k, v in TRUST_ENV.items())
    ENV_SH.write_text(
        "# Generated by regen-ca-bundle.py -- do not edit.\n"
        "# Shell fallback for sessions outside the GUI launchd domain (e.g. ssh).\n"
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
    assert_no_distrust()
    certs, stats = collect()

    proxyman = [c for c in certs if "Proxyman LLC" in subject(c)]
    if not proxyman:
        die("Proxyman CA absent from the assembled bundle")
    if len(certs) < 100:
        die(f"only {len(certs)} CA certs assembled; refusing to publish a truncated trust store")

    OUT.write_text("".join(certs))
    OUT.chmod(0o644)

    for name, (found, kept) in stats.items():
        print(f"  {name:38} {found:4} certs -> {kept:3} new CA")
    print(f"wrote {OUT} ({len(certs)} CA certs, Proxyman CA included)")

    print(f"wrote {write_env_sh()}")
    print(f"wrote {write_launch_agent()}")
    print(f"reloaded {LAUNCH_LABEL} in {reload_launch_agent()}; all 3 vars verified present")


if __name__ == "__main__":
    main()
