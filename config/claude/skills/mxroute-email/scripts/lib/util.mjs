// Pure helpers: password generation, DNS-over-HTTPS polling, terminal output.
// [LAW:effects-at-boundaries] the only effects here are stdout and one DoH GET;
// no provider state is touched.
import { randomInt } from 'node:crypto'

// Unambiguous alphabet (no I/O/0/1/l). Guarantees >=1 upper, lower, digit, symbol
// so the result always satisfies MXRoute's password rule (8+, upper+lower+digit).
const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const L = 'abcdefghijkmnpqrstuvwxyz'
const D = '23456789'
const S = '!@#%^*-_=+'
export function generatePassword(len = 24) {
  const all = U + L + D + S
  const pick = (s) => s[randomInt(s.length)]
  const out = [pick(U), pick(L), pick(D), pick(S)]
  while (out.length < len) out.push(pick(all))
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out.join('')
}

// TXT lookup via a public resolver (Google DoH). Used to confirm a record is
// actually visible on the public edge before depending on it — Cloudflare API
// writes can lag a specific authoritative node by minutes, but DoH reflects the
// edge. Surrounding quotes and chunk-joins are normalized away.
export async function dohTxt(name) {
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=TXT`, {
      headers: { accept: 'application/dns-json' },
    })
    if (!res.ok) return []
    const j = await res.json()
    return (j.Answer || []).map((a) => String(a.data || '').replace(/^"|"$/g, '').replace(/" "/g, ''))
  } catch {
    return []
  }
}

// Poll until a TXT record containing `valueSubstr` appears (or give up loudly).
export async function waitForTxt(name, valueSubstr, { tries = 18, intervalMs = 10000, log = () => {} } = {}) {
  for (let i = 1; i <= tries; i++) {
    const vals = await dohTxt(name)
    if (vals.some((v) => v.includes(valueSubstr))) return true
    log(`  …waiting for DNS to propagate: ${name} (${i}/${tries})`)
    if (i < tries) await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

const COLOR = { ok: '\x1b[32m', warn: '\x1b[33m', err: '\x1b[31m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' }
export const ok = (m) => console.log(`${COLOR.ok}✓${COLOR.reset} ${m}`)
export const info = (m) => console.log(`  ${m}`)
export const warn = (m) => console.log(`${COLOR.warn}!${COLOR.reset} ${m}`)
export const heading = (m) => console.log(`\n${COLOR.bold}${m}${COLOR.reset}`)
export const die = (m) => {
  console.error(`${COLOR.err}✗ ${m}${COLOR.reset}`)
  process.exit(1)
}
