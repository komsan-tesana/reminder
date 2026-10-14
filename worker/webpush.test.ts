import { describe, expect, it } from 'vitest'
import { b64uToBytes, bytesToB64u, encryptPayload, sendWebPush, vapidHeader, vapidPublicKey } from './src/webpush'

const dec = new TextDecoder()

// Test vector from RFC 8291 appendix A.
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

async function rfcSenderKeys(): Promise<CryptoKeyPair> {
  const pub = b64uToBytes(RFC.asPublic)
  const jwkBase = { kty: 'EC', crv: 'P-256', x: bytesToB64u(pub.slice(1, 33)), y: bytesToB64u(pub.slice(33, 65)) }
  const privateKey = await crypto.subtle.importKey('jwk', { ...jwkBase, d: RFC.asPrivate }, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])
  const publicKey = await crypto.subtle.importKey('jwk', jwkBase, { name: 'ECDH', namedCurve: 'P-256' }, true, [])
  return { privateKey, publicKey }
}

describe('payload encryption (RFC 8291)', () => {
  it('reproduces the RFC 8291 appendix A message byte for byte', async () => {
    const out = await encryptPayload({
      p256dh: RFC.uaPublic,
      auth: RFC.auth,
      payload: new TextEncoder().encode(RFC.plaintext),
      salt: b64uToBytes(RFC.salt),
      senderKeys: await rfcSenderKeys(),
    })
    expect(bytesToB64u(out)).toBe(RFC.body)
  })

  it('round-trips through an independent receiver implementation', async () => {
    // user agent side, written from the RFC separately from the sender code
    const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
    const uaPub = new Uint8Array((await crypto.subtle.exportKey('raw', ua.publicKey)) as ArrayBuffer)
    const authSecret = crypto.getRandomValues(new Uint8Array(16))
    const msg = JSON.stringify({ due: 1790000000, note: 'ทดสอบ' })
    const body = await encryptPayload({ p256dh: bytesToB64u(uaPub), auth: bytesToB64u(authSecret), payload: new TextEncoder().encode(msg) })

    const salt = body.slice(0, 16)
    expect(new DataView(body.buffer, body.byteOffset).getUint32(16)).toBe(4096)
    const asPub = body.slice(21, 21 + body[20])
    const cipher = body.slice(21 + body[20])
    const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
    const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256))
    const t = new TextEncoder()
    const derive = async (s: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) =>
      new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: s, info }, await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']), n * 8))
    const keyInfo = new Uint8Array([...t.encode('WebPush: info\0'), ...uaPub, ...asPub])
    const ikm = await derive(authSecret, secret, keyInfo, 32)
    const cek = await derive(salt, ikm, t.encode('Content-Encoding: aes128gcm\0'), 16)
    const nonce = await derive(salt, ikm, t.encode('Content-Encoding: nonce\0'), 12)
    const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), cipher))
    expect(plain.at(-1)).toBe(2)
    expect(dec.decode(plain.slice(0, -1))).toBe(msg)
  })
})

describe('VAPID (RFC 8292)', () => {
  it('signs a JWT the public key verifies, scoped to the push service origin', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    const header = await vapidHeader('https://web.push.apple.com/abc123?x=1', { subject: 'mailto:ops@example.com', privateJwk }, 1_790_000_000)
    const [, t, k] = header.match(/^vapid t=([^,]+), k=(.+)$/)!
    const [h, c, sig] = t.split('.')
    expect(JSON.parse(dec.decode(b64uToBytes(h)))).toEqual({ typ: 'JWT', alg: 'ES256' })
    expect(JSON.parse(dec.decode(b64uToBytes(c)))).toEqual({ aud: 'https://web.push.apple.com', exp: 1_790_000_000 + 12 * 3600, sub: 'mailto:ops@example.com' })
    expect(k).toBe(vapidPublicKey(privateJwk))
    expect(b64uToBytes(k)).toHaveLength(65)
    const verifyKey = await crypto.subtle.importKey('raw', b64uToBytes(k), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, b64uToBytes(sig), new TextEncoder().encode(`${h}.${c}`))
    expect(ok).toBe(true)
  })
})

describe('sendWebPush', () => {
  it('posts an encrypted body with the required headers and flags dead subscriptions', async () => {
    const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
    const target = {
      endpoint: 'https://fcm.googleapis.com/fcm/send/xyz',
      p256dh: bytesToB64u(new Uint8Array((await crypto.subtle.exportKey('raw', ua.publicKey)) as ArrayBuffer)),
      auth: bytesToB64u(crypto.getRandomValues(new Uint8Array(16))),
    }
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
    const vapid = { subject: 'mailto:ops@example.com', privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey) }
    let seen: { url: string; init: RequestInit } | null = null
    const fake = (status: number) => (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return new Response(null, { status })
    }) as unknown as typeof fetch

    const ok = await sendWebPush(target, { due: 1 }, vapid, { fetch: fake(201), nowSec: 1_790_000_000 })
    expect(ok).toEqual({ status: 201, gone: false })
    const h = seen!.init.headers as Record<string, string>
    expect(seen!.url).toBe(target.endpoint)
    expect(h['Content-Encoding']).toBe('aes128gcm')
    expect(h.TTL).toBe('3600')
    expect(h.Urgency).toBe('high')
    expect(h.Authorization).toMatch(/^vapid t=.+, k=.+$/)
    expect((seen!.init.body as Uint8Array).length).toBeGreaterThan(86)

    expect((await sendWebPush(target, {}, vapid, { fetch: fake(410), nowSec: 1 })).gone).toBe(true)
    expect((await sendWebPush(target, {}, vapid, { fetch: fake(404), nowSec: 1 })).gone).toBe(true)
    expect((await sendWebPush(target, {}, vapid, { fetch: fake(503), nowSec: 1 })).gone).toBe(false)
  })
})
