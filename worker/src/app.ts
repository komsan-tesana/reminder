import { b64uToBytes, sendWebPush, vapidPublicKey, type Vapid } from './webpush'
import type { Store } from './store'

// Limits keep one device from filling the database and stay inside the free Workers quotas
// (50 subrequests / queries per invocation).
export const MAX_SCHEDULE = 300
const MAX_BODY_BYTES = 64 * 1024
const MAX_FUTURE_SEC = 120 * 86400
/** a wake-up this late is no use any more (the notice would be about the past) */
export const STALE_AFTER_SEC = 6 * 3600
const BATCH = 20

// Only real push services; a subscription for any other host is refused.
const PUSH_HOSTS = /(^|\.)(googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/

export type Deps = {
  store: Store
  fetch: typeof fetch
  now: () => number // epoch seconds
  vapid: Vapid
  allowedOrigins: string[]
}

type Json = Record<string, unknown>

export type SyncInput = { endpoint: string; p256dh: string; auth: string; schedule: number[] }

/** Validate and normalise a /sync body; returns an error string or the clean input. */
export function parseSync(body: unknown, nowSec: number): SyncInput | string {
  const b = body as Json | null
  const sub = b?.subscription as Json | undefined
  const keys = sub?.keys as Json | undefined
  const endpoint = sub?.endpoint
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return 'bad endpoint'
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return 'bad endpoint'
  }
  if (url.protocol !== 'https:' || !PUSH_HOSTS.test(url.hostname)) return 'endpoint is not a known push service'
  const { p256dh, auth } = (keys ?? {}) as { p256dh?: unknown; auth?: unknown }
  try {
    if (typeof p256dh !== 'string' || b64uToBytes(p256dh).length !== 65) return 'bad p256dh'
    if (typeof auth !== 'string' || b64uToBytes(auth).length !== 16) return 'bad auth'
  } catch {
    return 'bad keys'
  }
  if (!Array.isArray(b?.schedule)) return 'schedule must be an array'
  const schedule = [...new Set((b.schedule as unknown[]).filter((n): n is number => Number.isInteger(n)))]
    .filter((n) => n > nowSec - 86400 && n < nowSec + MAX_FUTURE_SEC)
    .sort((a, c) => a - c)
    .slice(0, MAX_SCHEDULE)
  return { endpoint, p256dh: p256dh as string, auth: auth as string, schedule }
}

export function createApp(deps: Deps) {
  const cors = (req: Request): Record<string, string> => {
    const origin = req.headers.get('Origin')
    return origin && deps.allowedOrigins.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' }
      : {}
  }
  const reply = (req: Request, status: number, body: Json) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors(req) } })

  async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url)
    const origin = req.headers.get('Origin')
    // browsers always send Origin on cross-origin POSTs; refuse other sites outright
    if (origin && !deps.allowedOrigins.includes(origin)) return new Response('forbidden', { status: 403 })
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) })
    // publicKey is derived from the deployed private key, so the app (and scripts/deploy-worker.sh)
    // can check that its VAPID_PUBLIC_KEY matches; it is public by design
    if (req.method === 'GET' && url.pathname === '/health') return reply(req, 200, { ok: true, publicKey: vapidPublicKey(deps.vapid.privateJwk) })
    if (req.method !== 'POST') return reply(req, 404, { error: 'not found' })

    const raw = await req.text()
    if (raw.length > MAX_BODY_BYTES) return reply(req, 413, { error: 'too large' })
    let body: unknown
    try {
      body = JSON.parse(raw)
    } catch {
      return reply(req, 400, { error: 'invalid json' })
    }

    if (url.pathname === '/sync') {
      const input = parseSync(body, deps.now())
      if (typeof input === 'string') return reply(req, 400, { error: input })
      await deps.store.upsert(input, input.schedule, deps.now())
      return reply(req, 200, { ok: true, scheduled: input.schedule.length })
    }
    if (url.pathname === '/unsubscribe') {
      const endpoint = (body as Json | null)?.endpoint
      if (typeof endpoint !== 'string') return reply(req, 400, { error: 'bad endpoint' })
      await deps.store.remove(endpoint)
      return reply(req, 200, { ok: true })
    }
    return reply(req, 404, { error: 'not found' })
  }

  /** Cron: wake every device that has something due. Returns counts for logging/tests. */
  async function runDue() {
    const now = deps.now()
    const stats = { sent: 0, removed: 0, retry: 0, dropped: 0 }
    for (const row of await deps.store.due(now, BATCH)) {
      const schedule = (JSON.parse(row.schedule) as number[]).sort((a, b) => a - b)
      const due = schedule.filter((t) => t <= now)
      const rest = schedule.filter((t) => t > now)
      const fresh = due.filter((t) => t > now - STALE_AFTER_SEC)
      stats.dropped += due.length - fresh.length
      if (!fresh.length) {
        await deps.store.setSchedule(row.endpoint, rest)
        continue
      }
      try {
        // one wake-up covers everything due; the device decides what to show
        const res = await sendWebPush(row, { due: fresh[fresh.length - 1] }, deps.vapid, { fetch: deps.fetch, nowSec: now })
        if (res.gone) {
          await deps.store.remove(row.endpoint)
          stats.removed++
        } else if (res.status >= 200 && res.status < 300) {
          await deps.store.setSchedule(row.endpoint, rest)
          stats.sent++
        } else {
          stats.retry++ // 429/5xx: keep the schedule, try again next minute (stale entries age out)
        }
      } catch {
        stats.retry++
      }
    }
    await deps.store.flush() // one index write for the whole run, and none when nothing changed
    return stats
  }

  return { fetch: handle, runDue }
}

/**
 * Problem with the Worker's secrets, or null when they look usable. Push services reject a bad
 * VAPID `sub` claim with an opaque error, so check up front and say what to fix.
 */
export function configProblem(env: { VAPID_SUBJECT?: string; VAPID_PRIVATE_JWK?: string }): string | null {
  const subject = env.VAPID_SUBJECT?.trim()
  if (!subject) return 'VAPID_SUBJECT is not set: run `npx wrangler secret put VAPID_SUBJECT` (e.g. mailto:you@your-domain.com)'
  if (!/^(mailto:[^\s@]+@[^\s@]+\.[^\s@]+|https:\/\/[^\s]+)$/.test(subject)) return 'VAPID_SUBJECT must be a mailto: address or an https: URL'
  if (subject === 'mailto:you@example.com') return 'VAPID_SUBJECT is still the example value'
  if (!env.VAPID_PRIVATE_JWK) return 'VAPID_PRIVATE_JWK is not set: run `npx wrangler secret put VAPID_PRIVATE_JWK` (see worker/README.md)'
  try {
    const jwk = JSON.parse(env.VAPID_PRIVATE_JWK) as Record<string, unknown>
    if (typeof jwk.d !== 'string' || typeof jwk.x !== 'string' || typeof jwk.y !== 'string') return 'VAPID_PRIVATE_JWK must be the private JWK printed by scripts/gen-vapid.mjs (needs d, x and y)'
  } catch {
    return 'VAPID_PRIVATE_JWK is not valid JSON'
  }
  return null
}
