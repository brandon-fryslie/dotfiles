// Credential loading — the ONE place credentials are resolved.
// [LAW:one-source-of-truth] env overrides, else macOS keychain; nothing else
// reads secrets. Both consumers (mxroute.mjs, cloudflare.mjs) import from here.
import { execFileSync } from 'node:child_process'

const keychain = (slug) => {
  try {
    return execFileSync('security', ['find-generic-password', '-s', slug, '-w'], {
      encoding: 'utf8',
    }).trim()
  } catch {
    return null // not found or non-macOS — caller decides if that's fatal
  }
}

// MXRoute API needs three values (server, username, key). Stored together as one
// keychain JSON blob under slug `mxroute-api`, or via three env vars.
export function mxrouteCreds() {
  let { MXROUTE_SERVER: server, MXROUTE_USERNAME: username, MXROUTE_API_KEY: key } = process.env
  if (!server || !username || !key) {
    const raw = keychain('mxroute-api')
    if (raw) {
      let j
      try {
        j = JSON.parse(raw)
      } catch {
        throw new Error('keychain slug "mxroute-api" is not valid JSON (expected {server,username,key})')
      }
      server ||= j.server
      username ||= j.username
      key ||= j.key
    }
  }
  if (!server || !username || !key) {
    throw new Error(
      'MXRoute credentials not found. Set MXROUTE_SERVER / MXROUTE_USERNAME / MXROUTE_API_KEY, ' +
        'or store keychain slug "mxroute-api" as JSON {"server","username","key"}. ' +
        'Mint a key at panel.mxroute.com → API Keys (the Server + Username are shown on that page).'
    )
  }
  return { server, username, key }
}

// Cloudflare token (optional — DNS auto-apply falls back to manual if absent).
export function cloudflareToken() {
  return process.env.CLOUDFLARE_API_TOKEN?.trim() || keychain('cloudflare-api-token')
}
