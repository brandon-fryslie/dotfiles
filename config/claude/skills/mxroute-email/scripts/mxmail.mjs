#!/usr/bin/env node
// mxmail — manage MXRoute email (domains, mailboxes, forwarders, DNS) with no
// browser. Composition root: it wires the MXRoute API boundary to the Cloudflare
// DNS boundary. [LAW:decomposition] each subcommand does one thing; add-domain
// and scaffold orchestrate the primitives. Run `mxmail help` for usage.
import * as mx from './lib/mxroute.mjs'
import { findZone, ensureRecord } from './lib/cloudflare.mjs'
import { cloudflareToken } from './lib/creds.mjs'
import { generatePassword, waitForTxt, ok, info, warn, heading, die } from './lib/util.mjs'

function parseArgs(argv) {
  const positionals = []
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true
      } else {
        flags[key] = flags[key] !== undefined ? [].concat(flags[key], next) : next
        i++
      }
    } else {
      positionals.push(a)
    }
  }
  return { positionals, flags }
}

const splitEmail = (addr) => {
  const at = addr.indexOf('@')
  if (at < 1 || at === addr.length - 1) die(`not an email address: ${addr}`)
  return { user: addr.slice(0, at), domain: addr.slice(at + 1) }
}

// MXRoute DNS records name the apex as "@"; Cloudflare wants the fully-qualified
// name. Map one MXRoute DnsInfo payload to a flat list of desired CF records.
const fqdn = (name, domain) => (!name || name === '@' ? domain : `${name}.${domain}`)
function desiredRecords(domain, dns) {
  const recs = []
  for (const m of dns.mx_records || []) recs.push({ type: 'MX', name: domain, content: m.hostname, priority: m.priority })
  if (dns.spf) recs.push({ type: 'TXT', name: fqdn(dns.spf.name, domain), content: dns.spf.value })
  if (dns.dkim && dns.dkim.value) recs.push({ type: 'TXT', name: fqdn(dns.dkim.name, domain), content: dns.dkim.value })
  return recs
}

function printManual(records) {
  warn('DNS not applied automatically — add these records at your DNS provider:')
  for (const r of records) {
    const pri = r.priority != null ? ` (priority ${r.priority})` : ''
    console.log(`    ${r.type.padEnd(4)} ${r.name}${pri}  →  ${r.content}`)
  }
}

// Apply MXRoute's required records to Cloudflare, or print them for manual entry.
// Returns true if applied automatically.
async function applyDns(domain, records, { manual }) {
  if (manual || !cloudflareToken()) {
    printManual(records)
    return false
  }
  const zone = await findZone(domain)
  if (!zone) {
    warn(`no Cloudflare zone found for ${domain}.`)
    printManual(records)
    return false
  }
  for (const r of records) {
    const action = await ensureRecord(zone.id, r)
    const pri = r.priority != null ? ` (pri ${r.priority})` : ''
    ok(`${action.padEnd(9)} ${r.type} ${r.name}${pri}`)
  }
  return true
}

async function cmdAddDomain(domain, flags) {
  const manual = !!flags.manual
  heading(`Add domain: ${domain}`)

  const existing = await mx.listDomains()
  const already = existing.includes(domain)
  if (already) ok(`domain already on the account — reconciling DNS`)

  if (!already) {
    const v = await mx.getVerificationRecord()
    const vName = fqdn(v.name, domain)
    info(`ownership TXT: ${vName} → ${v.value}`)
    if (!manual && cloudflareToken()) {
      const zone = await findZone(domain)
      if (zone) {
        await ensureRecord(zone.id, { type: 'TXT', name: vName, content: v.value })
        ok(`verification TXT written to Cloudflare zone ${zone.name}`)
        info('waiting for it to resolve before adding the domain…')
        const seen = await waitForTxt(vName, v.value, { log: info })
        if (!seen) warn('verification TXT not visible yet on public DNS; trying anyway')
      } else {
        printManual([{ type: 'TXT', name: vName, content: v.value }])
        die('add the verification TXT above, then re-run add-domain.')
      }
    } else {
      printManual([{ type: 'TXT', name: vName, content: v.value }])
      die('add the verification TXT above (DNS is manual), then re-run add-domain.')
    }

    // Propagation can trail; retry the add a few times before giving up loudly.
    let added = false
    for (let attempt = 1; attempt <= 4 && !added; attempt++) {
      const r = await mx.addDomain(domain).catch((e) => ({ error: e }))
      if (r.error) {
        if (attempt === 4) throw r.error
        info(`add not accepted yet (attempt ${attempt}/4) — waiting 20s…`)
        await new Promise((res) => setTimeout(res, 20000))
      } else {
        added = true
        ok(r.existed ? 'domain already existed on MXRoute' : 'domain added to MXRoute')
      }
    }
  }

  const dns = await mx.getDns(domain)
  const records = desiredRecords(domain, dns)
  if (!dns.dkim || !dns.dkim.value) warn('DKIM not issued yet — re-run `apply-dns` shortly to add it.')
  heading('Sending/receiving DNS')
  await applyDns(domain, records, { manual })
  heading('Done')
  info(`${domain} can now receive mail. Create addresses with: mxmail scaffold ${domain}  (or mailbox/forwarder).`)
}

async function cmdApplyDns(domain, flags) {
  heading(`Reconcile DNS for ${domain}`)
  const dns = await mx.getDns(domain)
  const records = desiredRecords(domain, dns)
  if (!dns.dkim || !dns.dkim.value) warn('MXRoute has not issued a DKIM key for this domain yet.')
  await applyDns(domain, records, { manual: !!flags.manual })
}

async function cmdMailbox(addr, flags) {
  const { user, domain } = splitEmail(addr)
  const password = typeof flags.password === 'string' ? flags.password : generatePassword()
  const quota = flags.quota != null ? Number(flags.quota) : 1024
  const limit = flags.limit != null ? Number(flags.limit) : 9600
  await mx.createMailbox(domain, user, password, { quota, limit })
  ok(`mailbox created: ${addr}`)
  info(`password: ${password}`)
  info('webmail: panel.mxroute.com → Open Webmail (or IMAP/SMTP on your MXRoute server)')
}

async function cmdForwarder(addr, flags) {
  const { user, domain } = splitEmail(addr)
  const dests = flags.to == null ? [] : [].concat(flags.to)
  if (dests.length === 0) die('forwarder needs at least one --to <destination>')
  await mx.createForwarder(domain, user, dests)
  ok(`forwarder created: ${addr} → ${dests.join(', ')}`)
}

async function cmdCatchAll(domain, flags, type, address) {
  if (!['fail', 'blackhole', 'address'].includes(type)) die('catch-all type must be: fail | blackhole | address')
  if (type === 'address' && !address) die('catch-all address type needs a destination email as the 3rd argument')
  await mx.setCatchAll(domain, type, address)
  ok(`catch-all for ${domain} set to: ${type}${address ? ' → ' + address : ''}`)
}

// The recommended topology (a closed allowlist, no catch-all): three real
// mailboxes + named role forwarders into a hub box. Idempotent: skips anything
// that already exists.
async function cmdScaffold(domain, flags) {
  const hub = typeof flags['forward-to'] === 'string' ? flags['forward-to'] : `admin@${domain}`
  const boxes = ['hello', 'admin', 'dmarc']
  const forwards = ['support', 'billing', 'sales']

  heading(`Scaffold standard email for ${domain}`)
  const existingBoxes = (await mx.listMailboxes(domain)).map((m) => m.username)
  const created = []
  for (const u of boxes) {
    if (existingBoxes.includes(u)) {
      info(`mailbox ${u}@${domain} already exists — skipped`)
      continue
    }
    const password = generatePassword()
    await mx.createMailbox(domain, u, password)
    created.push([`${u}@${domain}`, password])
    ok(`mailbox ${u}@${domain}`)
  }

  const existingFwd = (await mx.listForwarders(domain)).map((f) => f.alias)
  for (const a of forwards) {
    if (existingFwd.includes(a)) {
      info(`forwarder ${a}@${domain} already exists — skipped`)
      continue
    }
    await mx.createForwarder(domain, a, [hub])
    ok(`forwarder ${a}@${domain} → ${hub}`)
  }

  await mx.setCatchAll(domain, 'fail')
  ok('catch-all set to reject (no wildcard — closed allowlist)')

  if (created.length) {
    heading('New mailbox passwords (store these now)')
    for (const [email, pw] of created) console.log(`    ${email}  ${pw}`)
  }
}

async function cmdList(domain) {
  heading(`${domain}`)
  const [boxes, fwds, ca] = await Promise.all([mx.listMailboxes(domain), mx.listForwarders(domain), mx.getCatchAll(domain)])
  console.log('  Mailboxes:')
  for (const m of boxes) console.log(`    ${m.email}  (quota ${m.quota}MB, sent ${m.sent}/${m.limit})`)
  console.log('  Forwarders:')
  for (const f of fwds) console.log(`    ${f.email} → ${f.destinations.join(', ')}`)
  console.log(`  Catch-all: ${ca.type}${ca.address ? ' → ' + ca.address : ''}`)
}

const HELP = `mxmail — manage MXRoute email without a browser

Usage: node mxmail.mjs <command> [args] [--flags]

Commands:
  add-domain <domain> [--manual]         Verify ownership, add the domain, and write MX/SPF/DKIM
                                         to Cloudflare (or print them with --manual).
  apply-dns <domain> [--manual]          (Re)write MXRoute's required DNS for an existing domain.
  scaffold <domain> [--forward-to <a@d>] Create the standard topology: hello@/admin@/dmarc@ boxes,
                                         support@/billing@/sales@ forwarders → admin@, catch-all=reject.
  mailbox <user@domain> [--password P] [--generate] [--quota MB] [--limit N]
                                         Create a real mailbox (password generated unless given).
  forwarder <alias@domain> --to <dest> [--to <dest2> ...]   Create a forwarder.
  catch-all <domain> <fail|blackhole|address> [address]     Set the catch-all policy.
  list <domain>                          Show mailboxes, forwarders, catch-all.
  domains                                List all domains on the account.
  verify-key                             Print the domain-ownership TXT record.

Credentials (no browser needed):
  MXRoute:    keychain slug "mxroute-api" = {"server","username","key"}  (or env MXROUTE_*).
  Cloudflare: keychain slug "cloudflare-api-token" (or env CLOUDFLARE_API_TOKEN). Optional — DNS
              steps fall back to printing records for manual entry when it is absent.
`

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2))
  const [cmd, ...rest] = positionals
  switch (cmd) {
    case 'add-domain':
      if (!rest[0]) die('usage: add-domain <domain>')
      return cmdAddDomain(rest[0], flags)
    case 'apply-dns':
      if (!rest[0]) die('usage: apply-dns <domain>')
      return cmdApplyDns(rest[0], flags)
    case 'scaffold':
      if (!rest[0]) die('usage: scaffold <domain>')
      return cmdScaffold(rest[0], flags)
    case 'mailbox':
      if (!rest[0]) die('usage: mailbox <user@domain>')
      return cmdMailbox(rest[0], flags)
    case 'forwarder':
      if (!rest[0]) die('usage: forwarder <alias@domain> --to <dest>')
      return cmdForwarder(rest[0], flags)
    case 'catch-all':
      if (!rest[0] || !rest[1]) die('usage: catch-all <domain> <fail|blackhole|address> [address]')
      return cmdCatchAll(rest[0], flags, rest[1], rest[2])
    case 'list':
      if (!rest[0]) die('usage: list <domain>')
      return cmdList(rest[0])
    case 'domains': {
      const ds = await mx.listDomains()
      for (const d of ds) console.log(d)
      return
    }
    case 'verify-key': {
      const v = await mx.getVerificationRecord()
      console.log(`${v.type}  ${v.name}  →  ${v.value}`)
      return
    }
    case 'help':
    case undefined:
      console.log(HELP)
      return
    default:
      die(`unknown command: ${cmd}\n\n${HELP}`)
  }
}

main().catch((e) => die(e.message))
