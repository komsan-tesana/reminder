import dayjs from 'dayjs'
import 'dayjs/locale/th'
import buddhistEra from 'dayjs/plugin/buddhistEra'
import type { Era } from '../types'

dayjs.extend(buddhistEra)

/** Format an ISO date; `YYYY` in the pattern becomes the Buddhist year when era is BE. */
export function fmtDate(iso: string, era: Era, pattern = 'D MMM YYYY'): string {
  const p = era === 'BE' ? pattern.replace('YYYY', 'BBBB') : pattern
  return dayjs(iso).locale('th').format(p)
}

export const fmtQty = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 3 })
