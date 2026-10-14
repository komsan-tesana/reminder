// Fill these in after deploying the Worker in /worker (see worker/README.md). Both values are
// public by design (the URL of your Worker and the VAPID *public* key), so they are safe to commit.
// While they are empty the "push to a locked phone" option stays hidden/disabled.

/** e.g. 'https://transport-calendar-push.<your-subdomain>.workers.dev' (no trailing slash) */
export const PUSH_SERVER_URL = ''

/** printed by `node worker/scripts/gen-vapid.mjs` */
export const VAPID_PUBLIC_KEY = ''

export const pushConfigured = () => PUSH_SERVER_URL !== '' && VAPID_PUBLIC_KEY !== ''
