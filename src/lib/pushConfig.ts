// Fill these in after deploying the Worker in /worker (see worker/README.md). Both values are
// public by design (the URL of your Worker and the VAPID *public* key), so they are safe to commit.
// While they are empty the "push to a locked phone" option stays hidden/disabled.

/** e.g. 'https://transport-calendar-push.<your-subdomain>.workers.dev' (no trailing slash) */
export const PUSH_SERVER_URL = 'https://transport-calendar-push.benaza009.workers.dev'

/** printed by `node worker/scripts/gen-vapid.mjs` */
export const VAPID_PUBLIC_KEY = 'BGh_lyVHr8pblUGEcWIgDBsF_RjhQTtbLVF2-xXgXvzaE67u_MbKWdcjkKw7pHm-jaz3J7X8MsxMSdPp_wT-I-Y'

export const pushConfigured = () => PUSH_SERVER_URL !== '' && VAPID_PUBLIC_KEY !== ''
