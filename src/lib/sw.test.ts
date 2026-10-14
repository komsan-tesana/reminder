import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import { replaceOutbox } from './outbox'
import type { OutboxItem } from './pushPlan'

// Runs the real public/sw.js with a stubbed service-worker scope, so the push handler (the part that
// shows notifications on a locked phone) is tested against the same IndexedDB layout the app writes.
type Shown = { title: string; body?: string; tag?: string }
let shown: Shown[]
let listeners: Record<string, (e: unknown) => void>

function loadWorker() {
  shown = []
  listeners = {}
  const self = {
    registration: {
      scope: 'https://example.github.io/reminder/',
      showNotification: async (title: string, o: { body?: string; tag?: string }) => void shown.push({ title, body: o.body, tag: o.tag }),
    },
    addEventListener: (type: string, fn: (e: unknown) => void) => (listeners[type] = fn),
    location: { origin: 'https://example.github.io' },
  }
  new Function('self', 'caches', 'indexedDB', 'URL', 'Response', 'fetch', readFileSync('public/sw.js', 'utf8'))(self, {}, indexedDB, URL, Response, fetch)
}

async function push(data: unknown) {
  let pending: Promise<unknown> = Promise.resolve()
  listeners.push({ data: data === undefined ? null : { json: () => data }, waitUntil: (p: Promise<unknown>) => (pending = p) })
  await pending
}

const now = () => Math.floor(Date.now() / 1000)
const item = (id: string, at: number, title = 'T', tag = id): OutboxItem => ({ id, at, title, body: `body ${id}`, tag })

beforeEach(async () => {
  await replaceOutbox([])
  loadWorker()
})

describe('service worker push handler', () => {
  it('shows what is due, and only once', async () => {
    await replaceOutbox([item('digest:a', now() - 30, 'แผนขนส่ง', 'digest'), item('later', now() + 3600)])
    await push({ due: now() })
    expect(shown).toEqual([{ title: 'แผนขนส่ง', body: 'body digest:a', tag: 'digest' }])
    shown.length = 0
    await push({ due: now() }) // the same wake-up arriving again: the due item is gone, only a generic notice remains
    expect(shown.map((s) => s.tag)).toEqual(['push-generic'])
  })

  it('leaves future items for later wake-ups', async () => {
    await replaceOutbox([item('soon', now() + 600)])
    await push({ due: now() })
    expect(shown.map((s) => s.tag)).toEqual(['push-generic'])
    await replaceOutbox([item('soon', now() + 600)]) // still stored: generic notice must not consume it
    shown.length = 0
    // time passes: the worker is woken again and now it is due
    await replaceOutbox([item('soon', now() - 1)])
    await push({ due: now() })
    expect(shown.map((s) => s.tag)).toEqual(['soon'])
  })

  it('always shows something (iOS revokes subscriptions whose pushes stay silent)', async () => {
    await push(undefined) // no payload at all
    expect(shown).toHaveLength(1)
    expect(shown[0].tag).toBe('push-generic')
  })

  it('shows several due items in time order', async () => {
    await replaceOutbox([item('b', now() - 10), item('a', now() - 100), item('c', now() - 1)])
    await push({ due: now() })
    expect(shown.map((s) => s.tag)).toEqual(['a', 'b', 'c'])
  })

  it('still shows a notice if the outbox cannot be read', async () => {
    const broken = { open: () => { throw new Error('storage blocked') } } as unknown as IDBFactory
    shown = []
    listeners = {}
    new Function('self', 'caches', 'indexedDB', 'URL', 'Response', 'fetch', readFileSync('public/sw.js', 'utf8'))(
      { registration: { scope: 'https://x/', showNotification: async (t: string, o: { tag?: string }) => void shown.push({ title: t, tag: o.tag }) }, addEventListener: (t: string, f: (e: unknown) => void) => (listeners[t] = f), location: { origin: 'https://x' } },
      {}, broken, URL, Response, fetch,
    )
    await push({ due: now() })
    expect(shown.map((s) => s.tag)).toEqual(['push-generic'])
  })
})
