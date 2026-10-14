import { beforeEach, describe, expect, it } from 'vitest'
import { configProblem, createApp, MAX_SCHEDULE, parseSync, STALE_AFTER_SEC } from './src/app'
import { deviceId, KVStore, RECORD_TTL_SEC, type KVLike } from './src/store'
import { b64uToBytes, bytesToB64u } from './src/webpush'

// An in-memory KV that counts operations, so the tests can prove the per-minute cron stays inside
// the free plan (reads are cheap; writes and list calls are what is capped at 1,000 a day).
class FakeKV implements KVLike {
  data = new Map<string, string>()
  ttl = new Map<string, number | undefined>()
  reads = 0
  writes = 0
  async get<T>(key: string): Promise<T | null> {
    this.reads++
    const v = this.data.get(key)
    return v === undefined ? null : (JSON.parse(v) as T)
  }
  async put(key: string, value: string, opts?: { expirationTtl?: number }) {
    this.writes++
    this.data.set(key, value)
    this.ttl.set(key, opts?.expirationTtl)
  }
  async delete(key: string) {
    this.writes++
    this.data.delete(key)
  }
  // there is deliberately no list(): the Worker must never need it
  resetCounts() {
    this.reads = 0
    this.writes = 0
  }
  records() {
    return [...this.data].filter(([k]) => k.startsWith('sub:')).map(([, v]) => JSON.parse(v) as { endpoint: string; schedule: number[]; updatedAt: number })
  }
  index() {
    return JSON.parse(this.data.get('index') ?? '{}') as Record<string, number>
  }
}

const ORIGIN = 'https://komsan-tesana.github.io'
const NOW = 1_790_000_000

async function newSubscription(endpoint = 'https://web.push.apple.com/AbC123') {
  const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  return {
    endpoint,
    keys: {
      p256dh: bytesToB64u(new Uint8Array((await crypto.subtle.exportKey('raw', ua.publicKey)) as ArrayBuffer)),
      auth: bytesToB64u(crypto.getRandomValues(new Uint8Array(16))),
    },
  }
}

let now = NOW
let pushStatus = 201
let pushed: { url: string }[] = []
/** runs while a push is "in flight", to model the app syncing at the same moment */
let onPush: (() => Promise<void>) | null = null
let kv: FakeKV
let vapidJwk: JsonWebKey
let app: ReturnType<typeof createApp>

// a new Store per call mirrors production, where each request/cron run builds its own
function buildApp(vapid: { subject: string; privateJwk: JsonWebKey }) {
  const make = () =>
    createApp({
      store: new KVStore(kv),
      fetch: (async (url: string) => {
        pushed.push({ url })
        await onPush?.()
        return new Response(null, { status: pushStatus })
      }) as unknown as typeof fetch,
      now: () => now,
      vapid,
      allowedOrigins: [ORIGIN],
    })
  return {
    fetch: (r: Request) => make().fetch(r),
    runDue: () => make().runDue(),
  }
}

beforeEach(async () => {
  now = NOW
  pushStatus = 201
  pushed = []
  onPush = null
  kv = new FakeKV()
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  vapidJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  app = buildApp({ subject: 'mailto:ops@example.com', privateJwk: vapidJwk })
})

const post = (path: string, body: unknown, origin: string | null = ORIGIN) =>
  app.fetch(new Request(`https://push.example.workers.dev${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify(body) }))

describe('GET /health', () => {
  it('reports ok and the public key that matches the deployed private key', async () => {
    const res = await app.fetch(new Request('https://push.example.workers.dev/health'))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; publicKey: string }
    expect(body.ok).toBe(true)
    expect(b64uToBytes(body.publicKey)).toHaveLength(65)
    expect(b64uToBytes(body.publicKey)[0]).toBe(4) // uncompressed P-256 point, what browsers expect
    // the same key must verify signatures made with the private key (i.e. they really are a pair)
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await crypto.subtle.importKey('jwk', vapidJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']), new Uint8Array([1, 2, 3]))
    const pub = await crypto.subtle.importKey('raw', b64uToBytes(body.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    expect(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, sig, new Uint8Array([1, 2, 3]))).toBe(true)
  })
})

describe('POST /sync', () => {
  it('stores a clean, sorted, de-duplicated schedule and indexes the earliest time', async () => {
    const sub = await newSubscription()
    const res = await post('/sync', { subscription: sub, schedule: [NOW + 300, NOW + 60, NOW + 60, 'x', 1.5, NOW + 10 * 86400] })
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    expect(await res.json()).toEqual({ ok: true, scheduled: 3 })
    expect(kv.records()[0].schedule).toEqual([NOW + 60, NOW + 300, NOW + 10 * 86400])
    expect(kv.index()[await deviceId(sub.endpoint)]).toBe(NOW + 60)
  })

  it('keeps KV keys short and free of the endpoint, and expires abandoned devices by TTL', async () => {
    const sub = await newSubscription('https://fcm.googleapis.com/fcm/send/' + 'x'.repeat(300))
    await post('/sync', { subscription: sub, schedule: [NOW + 60] })
    const key = [...kv.data.keys()].find((k) => k.startsWith('sub:'))!
    expect(key.length).toBeLessThan(40)
    expect(key).toBe(`sub:${await deviceId(sub.endpoint)}`)
    expect(kv.ttl.get(key)).toBe(RECORD_TTL_SEC)
  })

  it('replaces the previous schedule for the same device instead of adding to it', async () => {
    const sub = await newSubscription()
    await post('/sync', { subscription: sub, schedule: [NOW + 60, NOW + 120] })
    await post('/sync', { subscription: sub, schedule: [NOW + 900] })
    expect(kv.records()).toHaveLength(1)
    expect(kv.records()[0].schedule).toEqual([NOW + 900])
    expect(Object.values(kv.index())).toEqual([NOW + 900])
  })

  it('an identical re-sync costs no writes (the app syncs after every change and on every focus)', async () => {
    const sub = await newSubscription()
    await post('/sync', { subscription: sub, schedule: [NOW + 60, NOW + 120] })
    kv.resetCounts()
    now = NOW + 5
    expect((await post('/sync', { subscription: sub, schedule: [NOW + 60, NOW + 120] })).status).toBe(200)
    expect(kv.writes).toBe(0)
    expect(kv.reads).toBeGreaterThan(0)
  })

  it('an identical re-sync repairs a lost index entry with a single write', async () => {
    const sub = await newSubscription()
    await post('/sync', { subscription: sub, schedule: [NOW + 60] })
    kv.data.delete('index') // as if two writers had raced and one update was lost
    kv.resetCounts()
    now = NOW + 5
    await post('/sync', { subscription: sub, schedule: [NOW + 60] })
    expect(kv.writes).toBe(1) // only the index; the record itself was unchanged
    expect(kv.index()[await deviceId(sub.endpoint)]).toBe(NOW + 60)
  })

  it('drops times that are far in the past or beyond the horizon, and caps the list', () => {
    const sub = { endpoint: 'https://fcm.googleapis.com/fcm/send/q', keys: { p256dh: bytesToB64u(new Uint8Array(65)), auth: bytesToB64u(new Uint8Array(16)) } }
    const out = parseSync({ subscription: sub, schedule: [NOW - 3 * 86400, NOW + 200 * 86400, ...Array.from({ length: 500 }, (_, i) => NOW + 60 + i)] }, NOW)
    expect(typeof out).toBe('object')
    expect((out as { schedule: number[] }).schedule).toHaveLength(MAX_SCHEDULE)
    expect((out as { schedule: number[] }).schedule[0]).toBe(NOW + 60)
  })

  it('refuses endpoints that are not real push services, and malformed keys', async () => {
    const good = await newSubscription()
    for (const endpoint of ['https://evil.example.com/x', 'http://web.push.apple.com/x', 'https://web.push.apple.com.evil.com/x', 'not a url']) {
      const res = await post('/sync', { subscription: { ...good, endpoint }, schedule: [] })
      expect(res.status, endpoint).toBe(400)
    }
    expect((await post('/sync', { subscription: { ...good, keys: { p256dh: 'AAAA', auth: good.keys.auth } }, schedule: [] })).status).toBe(400)
    expect((await post('/sync', { subscription: { ...good, keys: { p256dh: good.keys.p256dh, auth: 'AAAA' } }, schedule: [] })).status).toBe(400)
    expect((await post('/sync', { subscription: good, schedule: 'nope' })).status).toBe(400)
    expect(kv.records()).toHaveLength(0)
  })

  it('answers the CORS preflight and rejects other origins', async () => {
    const pre = await app.fetch(new Request('https://push.example.workers.dev/sync', { method: 'OPTIONS', headers: { Origin: ORIGIN } }))
    expect(pre.status).toBe(204)
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN)
    const bad = await post('/sync', { subscription: await newSubscription(), schedule: [] }, 'https://evil.example.com')
    expect(bad.status).toBe(403)
    expect(kv.records()).toHaveLength(0)
  })

  it('removes a device and its index entry on /unsubscribe', async () => {
    const sub = await newSubscription()
    await post('/sync', { subscription: sub, schedule: [NOW + 60] })
    expect((await post('/unsubscribe', { endpoint: sub.endpoint })).status).toBe(200)
    expect(kv.records()).toHaveLength(0)
    expect(kv.index()).toEqual({})
  })

  it('keeps two devices independent in the shared index', async () => {
    const a = await newSubscription('https://web.push.apple.com/AAA')
    const b = await newSubscription('https://fcm.googleapis.com/fcm/send/BBB')
    await post('/sync', { subscription: a, schedule: [NOW + 60] })
    await post('/sync', { subscription: b, schedule: [NOW + 120] })
    expect(kv.index()).toEqual({ [await deviceId(a.endpoint)]: NOW + 60, [await deviceId(b.endpoint)]: NOW + 120 })
    await post('/unsubscribe', { endpoint: a.endpoint })
    expect(kv.index()).toEqual({ [await deviceId(b.endpoint)]: NOW + 120 })
  })
})

describe('cron: runDue', () => {
  it('an idle minute is one read and no writes (stays inside the free plan)', async () => {
    const sub = await newSubscription()
    await post('/sync', { subscription: sub, schedule: [NOW + 3600] })
    kv.resetCounts()
    now = NOW + 30
    expect(await app.runDue()).toMatchObject({ sent: 0 })
    expect(kv.reads).toBe(1)
    expect(kv.writes).toBe(0)
    expect(pushed).toHaveLength(0)
  })

  it('wakes a device once when something is due, then keeps only the future entries', async () => {
    const sub = await newSubscription()
    await post('/sync', { subscription: sub, schedule: [NOW + 60, NOW + 120, NOW + 3600] })
    now = NOW + 130 // two entries are due: still ONE push
    expect(await app.runDue()).toMatchObject({ sent: 1 })
    expect(pushed).toHaveLength(1)
    expect(pushed[0].url).toBe(sub.endpoint)
    expect(kv.records()[0].schedule).toEqual([NOW + 3600])
    expect(kv.index()[await deviceId(sub.endpoint)]).toBe(NOW + 3600)

    kv.resetCounts()
    expect(await app.runDue()).toMatchObject({ sent: 0 }) // nothing due now: no repeat, no writes
    expect(pushed).toHaveLength(1)
    expect(kv.writes).toBe(0)
  })

  it('a push costs a handful of writes: the device record plus one index write per run', async () => {
    const a = await newSubscription('https://web.push.apple.com/AAA')
    const b = await newSubscription('https://fcm.googleapis.com/fcm/send/BBB')
    await post('/sync', { subscription: a, schedule: [NOW + 60] })
    await post('/sync', { subscription: b, schedule: [NOW + 60] })
    kv.resetCounts()
    now = NOW + 61
    expect(await app.runDue()).toMatchObject({ sent: 2 })
    expect(kv.writes).toBe(3) // two records + ONE index write for both
    expect(kv.index()).toEqual({})
  })

  it('removes the device from the index once its schedule is empty', async () => {
    const sub = await newSubscription()
    await post('/sync', { subscription: sub, schedule: [NOW + 60] })
    now = NOW + 61
    await app.runDue()
    expect(kv.index()).toEqual({})
    expect(kv.records()[0].schedule).toEqual([])
  })

  it('deletes the device when the push service says it is gone (404/410)', async () => {
    const sub = await newSubscription()
    await post('/sync', { subscription: sub, schedule: [NOW + 60] })
    pushStatus = 410
    now = NOW + 61
    expect(await app.runDue()).toMatchObject({ removed: 1 })
    expect(kv.records()).toHaveLength(0)
    expect(kv.index()).toEqual({})
  })

  it('keeps the schedule for a retry on temporary errors', async () => {
    const sub = await newSubscription()
    await post('/sync', { subscription: sub, schedule: [NOW + 60] })
    pushStatus = 503
    now = NOW + 61
    expect(await app.runDue()).toMatchObject({ retry: 1, sent: 0 })
    expect(kv.records()[0].schedule).toEqual([NOW + 60])
    pushStatus = 201
    now = NOW + 120
    expect(await app.runDue()).toMatchObject({ sent: 1 })
  })

  it('drops wake-ups that are hours late without sending a stale notice', async () => {
    const sub = await newSubscription()
    await post('/sync', { subscription: sub, schedule: [NOW + 60, NOW + 7 * 3600] })
    now = NOW + 60 + STALE_AFTER_SEC + 1
    expect(await app.runDue()).toMatchObject({ sent: 0, dropped: 1 })
    expect(pushed).toHaveLength(0)
    expect(kv.records()[0].schedule).toEqual([NOW + 7 * 3600])
  })

  it('keeps a schedule the app synced while its push was in flight, instead of overwriting it', async () => {
    const sub = await newSubscription()
    await post('/sync', { subscription: sub, schedule: [NOW + 60] })
    now = NOW + 61
    onPush = async () => void (await post('/sync', { subscription: sub, schedule: [NOW + 900] }))
    expect(await app.runDue()).toMatchObject({ sent: 1 })
    expect(kv.records()[0].schedule).toEqual([NOW + 900])
    expect(kv.index()[await deviceId(sub.endpoint)]).toBe(NOW + 900)
  })

  it('forgets index entries whose record has expired (KV TTL) instead of failing', async () => {
    const sub = await newSubscription()
    await post('/sync', { subscription: sub, schedule: [NOW + 60] })
    kv.data.delete(`sub:${await deviceId(sub.endpoint)}`) // what KV does when the TTL runs out
    now = NOW + 61
    expect(await app.runDue()).toMatchObject({ sent: 0 })
    expect(kv.index()).toEqual({})
  })
})

describe('configProblem (the Worker secrets)', () => {
  const jwk = JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'x', y: 'y', d: 'd' })
  const ok = { VAPID_SUBJECT: 'mailto:ops@my-domain.com', VAPID_PRIVATE_JWK: jwk }
  it('accepts a mailto: or https: subject with a private JWK', () => {
    expect(configProblem(ok)).toBeNull()
    expect(configProblem({ ...ok, VAPID_SUBJECT: 'https://my-domain.com/contact' })).toBeNull()
    expect(configProblem({ ...ok, VAPID_SUBJECT: '  mailto:ops@my-domain.com  ' })).toBeNull()
  })
  it('names the secret to set when it is missing', () => {
    expect(configProblem({ VAPID_PRIVATE_JWK: jwk })).toMatch(/wrangler secret put VAPID_SUBJECT/)
    expect(configProblem({ VAPID_SUBJECT: ok.VAPID_SUBJECT })).toMatch(/wrangler secret put VAPID_PRIVATE_JWK/)
  })
  it('rejects a subject that is not a contact address, or still the example value', () => {
    expect(configProblem({ ...ok, VAPID_SUBJECT: 'ops@my-domain.com' })).toMatch(/mailto:/)
    expect(configProblem({ ...ok, VAPID_SUBJECT: 'http://insecure.example' })).toMatch(/mailto:/)
    expect(configProblem({ ...ok, VAPID_SUBJECT: 'mailto:you@example.com' })).toMatch(/example/)
  })
  it('rejects a private key that is not the JWK from gen-vapid.mjs', () => {
    expect(configProblem({ ...ok, VAPID_PRIVATE_JWK: 'not json' })).toMatch(/valid JSON/)
    expect(configProblem({ ...ok, VAPID_PRIVATE_JWK: JSON.stringify({ x: 'x', y: 'y' }) })).toMatch(/needs d, x and y/)
  })
})
