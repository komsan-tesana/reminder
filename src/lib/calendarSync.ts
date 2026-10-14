import { download } from './download'
import { currentPlatform } from './platform'

export type SyncResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * One-tap hand-off of an .ics to the device calendar.
 *
 * Browsers cannot write to a calendar directly, so on phones we open the system share sheet with
 * the file (it offers Calendar, and the user confirms once instead of hunting for a download).
 * Desktop, or any browser that cannot share files, falls back to a normal download.
 * Must be called straight from a click: share() needs the user gesture.
 */
export async function syncToDeviceCalendar(ics: string, filename: string): Promise<SyncResult> {
  const file = new File([ics], filename, { type: 'text/calendar' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (currentPlatform() !== 'desktop' && typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Transport Calendar' })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // share failed for another reason: fall through to a plain download
    }
  }
  download(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), filename)
  return 'downloaded'
}
