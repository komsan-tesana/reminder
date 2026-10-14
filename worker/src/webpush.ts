// Web Push for a Cloudflare Worker, using only WebCrypto + fetch (no Node APIs):
//   - VAPID authorization (RFC 8292): an ES256 JWT proving who is sending
//   - payload encryption (RFC 8291, aes128gcm content coding)
// The payload is deliberately tiny (a due-time number): the app builds the visible text itself.

const enc = new TextEncoder()

// TS 5.7+ distinguishes Uint8Array<ArrayBufferLike> from the BufferSource WebCrypto wants; these are
// always plain ArrayBuffer-backed arrays here, so the casts below are safe.
const bs = (b: Uint8Array) => b as unknown as BufferSource

export const b64uToBytes = (s: string): Uint8Array => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

export const bytesToB64u = (b: Uint8Array): string => {
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', bs(ikm), 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: bs(salt), info: bs(info) }, key, bytes * 8))
}

export type EncryptOptions = {
  /** subscription keys, base64url */
  p256dh: string
  auth: string
  payload: Uint8Array
  /** injectable for tests (RFC 8291 appendix A); random otherwise */
  salt?: Uint8Array
  senderKeys?: CryptoKeyPair
}

/** RFC 8291 aes128gcm: one record, header = salt | rs | idlen | sender public key. */
export async function encryptPayload(o: EncryptOptions): Promise<Uint8Array> {
  const uaPublic = b64uToBytes(o.p256dh)
  const authSecret = b64uToBytes(o.auth)
  const salt = o.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const sender = o.senderKeys ?? ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair)
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', sender.publicKey)) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', bs(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, sender.privateKey, 256))

  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  const record = concat(o.payload, new Uint8Array([2])) // 0x02 = delimiter of the last (only) record
  const aes = await crypto.subtle.importKey('raw', bs(cek), 'AES-GCM', false, ['encrypt'])
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: bs(nonce) }, aes, bs(record)))

  const header = new Uint8Array(21 + asPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096) // record size
  header[20] = asPublic.length
  header.set(asPublic, 21)
  return concat(header, cipher)
}

export type Vapid = { subject: string; privateJwk: JsonWebKey }

/** Uncompressed P-256 public point (0x04|x|y), base64url: what browsers call applicationServerKey. */
export const vapidPublicKey = (jwk: JsonWebKey): string => bytesToB64u(concat(new Uint8Array([4]), b64uToBytes(jwk.x!), b64uToBytes(jwk.y!)))

export async function vapidHeader(endpoint: string, vapid: Vapid, nowSec: number): Promise<string> {
  const header = bytesToB64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = bytesToB64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSec + 12 * 3600, sub: vapid.subject })))
  const key = await crypto.subtle.importKey('jwk', vapid.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  // WebCrypto returns the raw r|s form JWTs require
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, bs(enc.encode(`${header}.${claims}`))))
  return `vapid t=${header}.${claims}.${bytesToB64u(sig)}, k=${vapidPublicKey(vapid.privateJwk)}`
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string }
export type SendResult = { status: number; gone: boolean }

export async function sendWebPush(
  target: PushTarget,
  payload: unknown,
  vapid: Vapid,
  deps: { fetch: typeof fetch; nowSec: number; ttl?: number },
): Promise<SendResult> {
  const body = await encryptPayload({ p256dh: target.p256dh, auth: target.auth, payload: enc.encode(JSON.stringify(payload)) })
  const res = await deps.fetch(target.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(target.endpoint, vapid, deps.nowSec),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(deps.ttl ?? 3600), // keep trying for an hour if the phone is off
      Urgency: 'high',
    },
    body: bs(body),
  })
  // 404/410: the user revoked permission or reinstalled; the subscription is dead
  return { status: res.status, gone: res.status === 404 || res.status === 410 }
}
