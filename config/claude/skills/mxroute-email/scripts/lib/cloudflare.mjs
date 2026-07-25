// Cloudflare DNS boundary — the ONLY module that talks to api.cloudflare.com.
// [LAW:effects-at-boundaries] all DNS writes live here. [LAW:no-silent-failure]
// every call checks the `success` envelope and throws with CF's own errors.
// Records are upserted idempotently (create missing, update drifted, never
// delete) so every operation is safe to re-run.
import { cloudflareToken } from './creds.mjs'

const BASE = 'https://api.cloudflare.com/client/v4'

async function cf(method, path, body) {
  const token = cloudflareToken()
  if (!token) throw new Error('Cloudflare token not found (set CLOUDFLARE_API_TOKEN or keychain slug cloudflare-api-token)')
  const res = await fetch(BASE + path, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const j = await res.json().catch(() => ({}))
  if (!j.success) {
    const errs = (j.errors || []).map((e) => e.message).join('; ') || `HTTP ${res.status}`
    throw new Error(`Cloudflare: ${method} ${path} failed: ${errs}`)
  }
  return j
}

// The registrable zone for a name may be the name itself or a parent. Try the
// name and each parent until a zone matches (or return null → caller falls back
// to printing records for manual entry).
export async function findZone(domain) {
  const parts = domain.split('.')
  for (let i = 0; i < parts.length - 1; i++) {
    const name = parts.slice(i).join('.')
    const j = await cf('GET', `/zones?name=${encodeURIComponent(name)}`)
    if (j.result?.length) return { id: j.result[0].id, name: j.result[0].name }
  }
  return null
}

// TXT values for the same name can be distinct records (SPF vs DKIM vs a verify
// token). Group by "family" so an upsert replaces the right one instead of
// duplicating. Surrounding quotes (MXRoute returns DKIM quoted) are stripped so
// stored content is the bare value.
const stripQuotes = (s) => s.replace(/^"([\s\S]*)"$/, '$1')
const txtFamily = (content) => {
  const v = stripQuotes(content)
  if (/^v=spf1/i.test(v)) return 'spf'
  if (/^v=DKIM1/i.test(v)) return 'dkim'
  if (/^v=DMARC1/i.test(v)) return 'dmarc'
  return v
}
const normHost = (h) => h.replace(/\.$/, '').toLowerCase()

function isMatch(existing, rec) {
  if (existing.type !== rec.type || existing.name !== rec.name) return false
  if (rec.type === 'MX') return normHost(existing.content) === normHost(rec.content)
  if (rec.type === 'TXT') return txtFamily(existing.content) === txtFamily(rec.content)
  return existing.content === rec.content
}

// rec: { type, name (fully-qualified), content, priority? }. Returns
// 'created' | 'updated' | 'unchanged'.
export async function ensureRecord(zoneId, rec) {
  const content = rec.type === 'TXT' ? stripQuotes(rec.content) : rec.content
  const desired = { ...rec, content }
  const list = await cf(
    'GET',
    `/zones/${zoneId}/dns_records?type=${rec.type}&name=${encodeURIComponent(rec.name)}&per_page=100`
  )
  const match = (list.result || []).find((e) => isMatch(e, desired))
  const payload = { type: rec.type, name: rec.name, content, ttl: 1, ...(rec.priority != null ? { priority: rec.priority } : {}) }

  if (match) {
    const same = match.content === content && (rec.type !== 'MX' || (match.priority ?? null) === (rec.priority ?? null))
    if (same) return 'unchanged'
    await cf('PUT', `/zones/${zoneId}/dns_records/${match.id}`, payload)
    return 'updated'
  }
  await cf('POST', `/zones/${zoneId}/dns_records`, payload)
  return 'created'
}
