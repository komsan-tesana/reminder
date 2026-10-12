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

/**
 * Chip-friendly company name: drops the legal prefix/suffix (บริษัท, หจก., จำกัด, (มหาชน)) so the
 * distinguishing part is what fits in a narrow calendar cell. Falls back to the full name.
 */
export function shortName(name: string): string {
  const short = name
    .replace(/^\s*(บริษัท|บจก\.?|บมจ\.?|หจก\.?|ห้างหุ้นส่วนจำกัด|ร้าน)\s*/, '')
    .replace(/\s*\(มหาชน\)\s*/g, ' ')
    .replace(/\s*จำกัด\s*$/, '')
    .trim()
  return short || name
}

export const fmtQty = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 3 })
