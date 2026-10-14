// Generates the VAPID key pair used to sign push messages. Run once:
//   node worker/scripts/gen-vapid.mjs
// The private key is a secret: only ever paste it into `wrangler secret put`, never commit it.
import { webcrypto as crypto } from 'node:crypto'

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
const b64u = (s) => Buffer.from(s, 'base64url')
const pub = Buffer.concat([Buffer.from([4]), b64u(jwk.x), b64u(jwk.y)]).toString('base64url')

console.log('PUBLIC KEY (safe to commit; goes in src/lib/pushConfig.ts):')
console.log(pub)
console.log('\nPRIVATE KEY (secret!): run `cd worker && npx wrangler secret put VAPID_PRIVATE_JWK` and paste this one line:')
console.log(JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, d: jwk.d }))
