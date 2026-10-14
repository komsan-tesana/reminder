import { download } from './download'
import { currentPlatform } from './platform'

export type SyncResult = 'opened' | 'downloaded'

/**
 * Safari on iPhone hands a `data:text/calendar` link straight to the Calendar app, which shows its
 * own "Add All events" sheet. (The share sheet has no Calendar target for .ics files, and blob: URLs
 * only show the text, so a data: URI is the form that works.)
 */
export const icsDataUri = (ics: string) => 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics)

/**
 * One-tap hand-off of an .ics to the device calendar. Browsers cannot write to a calendar
 * themselves; the OS always asks the user to confirm. iPhone: opens the Calendar import sheet.
 * Everything else: downloads the file (opening it then imports it into the default calendar app).
 * Call straight from a click.
 */
export function syncToDeviceCalendar(ics: string, filename: string): SyncResult {
  if (currentPlatform() === 'ios') {
    const a = document.createElement('a')
    a.href = icsDataUri(ics)
    a.rel = 'noopener'
    // attached to the page first: Safari ignores clicks on detached links
    document.body.appendChild(a)
    a.click()
    a.remove()
    return 'opened'
  }
  download(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), filename)
  return 'downloaded'
}
