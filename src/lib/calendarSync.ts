import { download } from './download'
import { currentPlatform } from './platform'

export type SyncResult =
  /** the system "Add to Calendar" sheet was opened */
  | 'opened'
  /** fell back to a file download */
  | 'downloaded'
  /** iPhone, but the service worker is not controlling this page yet (first visit) */
  | 'needs-reload'

const ICS_CACHE = 'transport-calendar-ics' // must match public/sw.js
const ICS_TYPE = 'text/calendar; charset=utf-8'

/**
 * iPhone: Safari opens Calendar's own "Add All" sheet for a real http(s) response of type
 * text/calendar. data: links are blocked and blob: links only show text, and a static host has no
 * per-user file, so the service worker serves one: we store the calendar in its cache and navigate
 * to ./calendar.ics. Returns false if the worker is not serving it (caller falls back to download).
 */
async function openViaServiceWorker(ics: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller || typeof caches === 'undefined') return false
  const base = new URL('calendar.ics', document.baseURI).href
  const cache = await caches.open(ICS_CACHE)
  await cache.put(base, new Response(ics, { headers: { 'Content-Type': ICS_TYPE, 'Cache-Control': 'no-store' } }))
  const url = `${base}?v=${Date.now()}`
  // prove the worker serves it as a calendar before leaving, otherwise we would navigate to a 404
  const probe = await fetch(url, { cache: 'no-store' })
  if (!probe.ok || !(probe.headers.get('content-type') ?? '').startsWith('text/calendar')) return false
  window.location.assign(url)
  return true
}

/**
 * One-tap hand-off of an .ics to the device calendar. Browsers cannot write to a calendar
 * themselves; the OS always asks the user to confirm. iPhone: opens the Calendar import sheet.
 * Everything else: downloads the file (opening it then imports it into the default calendar app).
 */
export async function syncToDeviceCalendar(ics: string, filename: string): Promise<SyncResult> {
  const downloadIt = () => download(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), filename)
  if (currentPlatform() === 'ios') {
    try {
      if (await openViaServiceWorker(ics)) return 'opened'
    } catch {
      /* cache or fetch unavailable: fall through to download */
    }
    downloadIt()
    return 'serviceWorker' in navigator && !navigator.serviceWorker.controller ? 'needs-reload' : 'downloaded'
  }
  downloadIt()
  return 'downloaded'
}
