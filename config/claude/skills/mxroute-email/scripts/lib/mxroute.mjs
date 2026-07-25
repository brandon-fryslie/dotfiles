// MXRoute API boundary — the ONLY module that talks to api.mxroute.com.
// [LAW:effects-at-boundaries] every MXRoute HTTP call lives here; callers get
// plain data or a loud throw. [LAW:no-silent-failure] any unexpected status
// throws with the server's own error message and the HTTP code.
import { mxrouteCreds } from './creds.mjs'

const BASE = 'https://api.mxroute.com'

async function call(method, path, body) {
  const { server, username, key } = mxrouteCreds()
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'X-Server': server,
      'X-Username': username,
      'X-API-Key': key,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text }
  }
  return { status: res.status, ok: res.ok, json }
}

function fail(ctx, r) {
  const msg = r.json?.error?.message || r.json?.message || r.json?.raw || JSON.stringify(r.json)
  throw new Error(`MXRoute: ${ctx} failed (HTTP ${r.status}): ${msg}`)
}

// GET /verification-key → { type, name, value } TXT record proving ownership.
export async function getVerificationRecord() {
  const r = await call('GET', '/verification-key')
  if (!r.ok) fail('get verification key', r)
  return r.json.data.record
}

export async function listDomains() {
  const r = await call('GET', '/domains')
  if (!r.ok) fail('list domains', r)
  return r.json.data
}

// POST /domains — idempotent for our purposes: an existing domain (409) is a
// success signal, not an error, so add-domain can be re-run safely.
export async function addDomain(domain) {
  const r = await call('POST', '/domains', { domain })
  if (r.status === 409) return { existed: true }
  if (!r.ok) fail(`add domain ${domain}`, r)
  return { existed: false, data: r.json.data }
}

// GET /domains/{d}/dns → the exact records MXRoute wants (mx_records, spf, dkim,
// verification). This is why nothing is hardcoded — the source of truth is live.
export async function getDns(domain) {
  const r = await call('GET', `/domains/${domain}/dns`)
  if (!r.ok) fail(`get DNS for ${domain}`, r)
  return r.json.data
}

export async function listMailboxes(domain) {
  const r = await call('GET', `/domains/${domain}/email-accounts`)
  if (!r.ok) fail(`list mailboxes for ${domain}`, r)
  return r.json.data
}

export async function createMailbox(domain, username, password, { quota = 1024, limit = 9600 } = {}) {
  const r = await call('POST', `/domains/${domain}/email-accounts`, { username, password, quota, limit })
  if (!r.ok) fail(`create mailbox ${username}@${domain}`, r)
  return r.json.data ?? { username, domain }
}

export async function listForwarders(domain) {
  const r = await call('GET', `/domains/${domain}/forwarders`)
  if (!r.ok) fail(`list forwarders for ${domain}`, r)
  return r.json.data
}

export async function createForwarder(domain, alias, destinations) {
  const r = await call('POST', `/domains/${domain}/forwarders`, { alias, destinations })
  if (!r.ok) fail(`create forwarder ${alias}@${domain}`, r)
  return r.json.data ?? { alias, domain, destinations }
}

export async function getCatchAll(domain) {
  const r = await call('GET', `/domains/${domain}/catch-all`)
  if (!r.ok) fail(`get catch-all for ${domain}`, r)
  return r.json.data
}

// type: 'fail' | 'blackhole' | 'address' (address requires `address`).
export async function setCatchAll(domain, type, address) {
  const body = type === 'address' ? { type, address } : { type }
  const r = await call('PATCH', `/domains/${domain}/catch-all`, body)
  if (!r.ok) fail(`set catch-all for ${domain}`, r)
  return r.json.data ?? { type, address }
}
