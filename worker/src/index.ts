import { configProblem, createApp } from './app'
import { KVStore, type KVLike } from './store'

type Env = {
  /** KV namespace binding (see wrangler.toml) */
  KV: KVLike
  /** secret: the full VAPID private JWK as one line of JSON (see scripts/gen-vapid.mjs) */
  VAPID_PRIVATE_JWK?: string
  /** secret: mailto: or https: contact the push services can reach if we misbehave */
  VAPID_SUBJECT?: string
  /** comma-separated origins allowed to call this API */
  ALLOWED_ORIGINS: string
}

type Ctx = { waitUntil(p: Promise<unknown>): void }

const build = (env: Env) =>
  createApp({
    store: new KVStore(env.KV),
    fetch: (...args) => fetch(...args),
    now: () => Math.floor(Date.now() / 1000),
    vapid: { subject: env.VAPID_SUBJECT!.trim(), privateJwk: JSON.parse(env.VAPID_PRIVATE_JWK!) },
    allowedOrigins: env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  })

export default {
  fetch: (req: Request, env: Env) => {
    const problem = configProblem(env)
    // say what is wrong instead of failing later with an opaque push-service error
    if (problem) return new Response(JSON.stringify({ ok: false, error: problem }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    return build(env).fetch(req)
  },
  scheduled: (_event: unknown, env: Env, ctx: Ctx) => {
    const problem = configProblem(env)
    if (problem) {
      console.error(problem)
      return
    }
    ctx.waitUntil(build(env).runDue())
  },
}
