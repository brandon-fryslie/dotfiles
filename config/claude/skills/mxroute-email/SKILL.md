---
name: mxroute-email
description: >-
  Manage MXRoute email hosting from the command line with NO browser — add a
  domain end-to-end (ownership verification + MX/SPF/DKIM written into Cloudflare
  DNS), create mailboxes and forwarders, set the catch-all, and scaffold a
  standard address topology. Use whenever the user wants to set up or manage
  email for a domain on MXRoute: "add <domain> to MXRoute", "set up email for
  <domain>", "create an email address / mailbox / forwarder on <domain>", "point
  <domain>'s email at MXRoute", or mentions MXRoute / mxpanel / mxrouting.
---

# MXRoute email management

A CLI (`scripts/mxmail.mjs`) that drives the **MXRoute API** (`api.mxroute.com`)
for mailboxes/forwarders/domains and the **Cloudflare API** for the DNS those
domains need. No browser, no MCP server, no manual panel clicking.

## When to use

Adding a new domain to MXRoute, or creating/removing email addresses on a domain
already there. The whole "add a domain and configure its email" flow is two
commands (`add-domain` then `scaffold`).

## Prerequisites (one-time)

Two credentials, both read from the macOS keychain (or env vars):

| What | Keychain slug | Env fallback |
|---|---|---|
| MXRoute API (JSON `{"server","username","key"}`) | `mxroute-api` | `MXROUTE_SERVER`, `MXROUTE_USERNAME`, `MXROUTE_API_KEY` |
| Cloudflare API token | `cloudflare-api-token` | `CLOUDFLARE_API_TOKEN` |

Check they exist: `security find-generic-password -s mxroute-api -w` and
`... -s cloudflare-api-token -w`. If the MXRoute one is **missing**, that is the
only step that needs the browser, and only once:

1. Open `panel.mxroute.com` → **API Keys** (log in if needed).
2. The page shows **Server** (X-Server) and **Username** (X-Username). Create a
   new key — the secret is shown **once**.
3. Store all three together:
   ```
   security add-generic-password -U -s mxroute-api -a <username> \
     -w '{"server":"<server>","username":"<username>","key":"<key>"}'
   ```

The Cloudflare token is optional: without it, every DNS step still runs but
prints the records for manual entry instead of writing them.

## The commands

Run with `node ~/.claude/skills/mxroute-email/scripts/mxmail.mjs <command>`
(`help` lists everything). The important ones:

- `add-domain <domain>` — the full onboarding: fetch the ownership TXT, write it
  to Cloudflare, wait for it to resolve, add the domain to MXRoute, then write
  MX + SPF + DKIM (fetched live from MXRoute, never hardcoded). Idempotent and
  re-runnable. Add `--manual` to print records instead of writing DNS.
- `scaffold <domain>` — create the recommended topology in one shot (see below).
  Idempotent (skips what exists). Prints every generated mailbox password once.
- `mailbox <user@domain> [--password P] [--quota MB] [--limit N]` — one mailbox
  (password generated unless given).
- `forwarder <alias@domain> --to <dest> [--to <dest2> ...]` — one forwarder.
- `catch-all <domain> <fail|blackhole|address> [address]` — set the policy.
- `list <domain>` / `domains` / `apply-dns <domain>` / `verify-key`.

## The standard workflow

```
node .../mxmail.mjs add-domain example.com     # ownership + MX/SPF/DKIM
node .../mxmail.mjs scaffold example.com        # addresses (see topology below)
node .../mxmail.mjs list example.com            # confirm
```

Then tell the user the mailbox passwords `scaffold` printed, and that DKIM can
take a few minutes to propagate (re-run `apply-dns` if it wasn't issued yet).

## The recommended topology (what `scaffold` builds)

A **closed allowlist, never a catch-all** — a catch-all accepts every possible
local-part and is a spam magnet. Instead:

- **Real mailboxes:** `hello@` (primary / the `From`/support-facing address),
  `admin@` (operational hub), `dmarc@` (a dedicated sink for DMARC report XML,
  kept out of the inbox you read).
- **Role forwarders → `admin@`:** `support@`, `billing@`, `sales@`.
- **Catch-all = reject.** Every accepted address is one you declared.

Deviate when the user asks (e.g. a different hub with `--forward-to`, extra role
addresses via `forwarder`, or dedicated boxes instead of forwards).

## Notes that matter

- **DNS records are fetched live** from MXRoute's `/dns` endpoint, so a server or
  DKIM-key change on their side is picked up automatically — nothing to update
  here.
- **Two senders on one domain coexist.** If the domain also sends transactional
  mail via another provider (e.g. Resend on a `send.` subdomain), MXRoute's apex
  MX/SPF/DKIM do not conflict — SPF is envelope-scoped and each sender has its
  own DKIM selector. Don't remove the other provider's records; `apply-dns` only
  upserts MXRoute's and never deletes.
- **Passwords** are generated to satisfy MXRoute's rule (8+, upper+lower+digit)
  and printed once. There is deliberately no `delete` command — removals are
  rare and destructive; do them in the panel or with an explicit API call.
- If a domain isn't on Cloudflare, every command still works but DNS is printed
  for manual entry (loud, never silently skipped).
