import { describe, expect, it } from 'vitest'
import { applyFilters, EMPTY, NO_FILTERS, uniqueValues } from './filters'
import { buildGroups } from './group'
import { parseBackup, toBackup, toCSV, toICS, toRows, foldLine, fmtExportDate } from './exporters'
import { addDays, dailyDigest, dueReminders, localDateTime, shouldFireDigest } from './reminders'
import { autoMap, buildShipments } from './mapping'
import { availableFields, effectiveGroupBy, groupOptions } from './available'
import type { Shipment } from '../types'

const make = (over: Partial<Shipment> = {}): Shipment => ({
  id: 'a', date: '2026-10-12', requestedDate: '2026-10-12', so: 'SO1', customerRef: '', customerCode: 'C1',
  customerName: 'บริษัท เอ จำกัด', itemNo: 'I1', description: 'Pallet, "A"', qty: 40, unit: 'Pcs', site: 'BP1',
  location: '', remark: '', deliveryOrder: '', driver: '', truckNo: '', plate: '', status: '', source: 't', raw: {},
  ...over,
})

describe('filters', () => {
  const rows = [make({ id: '1' }), make({ id: '2', site: 'BP4', driver: 'สมชาย', status: 'ขึ้นค้าง' })]
  it('returns everything with no filters', () => expect(applyFilters(rows, NO_FILTERS)).toBe(rows))
  it('filters by site, empty sentinel and text', () => {
    expect(applyFilters(rows, { ...NO_FILTERS, site: 'BP4' }).map((r) => r.id)).toEqual(['2'])
    expect(applyFilters(rows, { ...NO_FILTERS, driver: EMPTY }).map((r) => r.id)).toEqual(['1'])
    expect(applyFilters(rows, { ...NO_FILTERS, q: 'สมชาย' }).map((r) => r.id)).toEqual(['2'])
  })
  it('lists unique non-empty values', () => expect(uniqueValues(rows, (s) => s.driver)).toEqual(['สมชาย']))
})

describe('export', () => {
  it('formats Buddhist dates', () => expect(fmtExportDate('2026-10-12', 'BE')).toBe('12/10/2569'))
  it('escapes CSV and adds a BOM', () => {
    const csv = toCSV([['a', 'b,"c"'], [1, 2]])
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('a,"b,""c"""')
  })
  it('round-trips through the importer (CE and BE)', () => {
    for (const fmt of ['CE', 'BE'] as const) {
      const src = [make({ id: '1' }), make({ id: '2', date: '2026-11-03', requestedDate: '2026-11-03', so: 'SO2', driver: 'สมชาย' })]
      const [headers, ...body] = toRows(src, fmt)
      const { items, errors } = buildShipments(headers as string[], body, autoMap(headers as string[]), 'auto', 'x')
      expect(errors).toHaveLength(0)
      expect(items.map((i) => i.date).sort()).toEqual(['2026-10-12', '2026-11-03'])
      expect(items.find((i) => i.so === 'SO2')?.driver).toBe('สมชาย')
    }
  })
  it('builds a valid, folded ICS', () => {
    const rows = Array.from({ length: 3 }, (_, i) => make({ id: String(i), description: 'ก'.repeat(80) }))
    const ics = toICS(buildGroups(rows, 'customer'), new Date('2026-10-12T00:00:00Z'))
    expect(ics).toContain('DTSTART;VALUE=DATE:20261012')
    expect(ics).toContain('DTEND;VALUE=DATE:20261013')
    expect(ics).toContain('TRIGGER:-PT15H')
    const enc = new TextEncoder()
    for (const line of ics.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75)
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
  })
  it('folds without splitting characters', () => {
    const folded = foldLine('X:' + 'ก'.repeat(100))
    expect(folded.replace(/\r\n /g, '')).toBe('X:' + 'ก'.repeat(100))
  })
})

describe('backup', () => {
  it('round-trips and drops junk', () => {
    const text = toBackup([make({ editedAt: 5 })], [{ id: 'r', title: 't', at: '2026-10-12T08:00', done: false }])
    const back = parseBackup(text)
    expect(back.shipments[0].editedAt).toBe(5)
    expect(back.reminders).toHaveLength(1)
    const dirty = JSON.stringify({ app: 'transport-calendar-backup', shipments: [{ id: 'x', date: 'nope' }, { id: 'y', date: '2026-01-02', evil: 1 }], reminders: [{ id: 'q', at: 'bad' }] })
    const d = parseBackup(dirty)
    expect(d.shipments).toHaveLength(1)
    expect(d.shipments[0]).not.toHaveProperty('evil')
    expect(d.reminders).toHaveLength(0)
  })
  it('rejects foreign files', () => {
    expect(() => parseBackup('not json')).toThrow()
    expect(() => parseBackup('{"shipments":[]}')).toThrow()
  })
})

describe('reminders', () => {
  const now = new Date(2026, 9, 12, 9, 0) // 12 Oct 2026 09:00 local
  const rows = [make({ id: '1', date: '2026-10-12' }), make({ id: '2', date: '2026-10-12', driver: 'x' }), make({ id: '3', date: '2026-10-13' })]
  it('adds days across month ends', () => expect(addDays('2026-10-31', 1)).toBe('2026-11-01'))
  it('summarises today and tomorrow', () => {
    const d = dailyDigest(rows, now, { today: true, daysAhead: 1 })
    expect(d?.body).toBe('วันนี้ 2 รายการ (ยังไม่จัดรถ 1)\nพรุ่งนี้ 1 รายการ (ยังไม่จัดรถ 1)')
    expect(dailyDigest(rows, now, { today: false, daysAhead: 0 })).toBeNull()
    expect(dailyDigest([], now, { today: true, daysAhead: 3 })).toBeNull()
  })
  it('lists each upcoming day separately and skips empty days', () => {
    const more = [...rows, make({ id: '4', date: '2026-10-15' }), make({ id: '5', date: '2026-10-30' })]
    const d = dailyDigest(more, now, { today: true, daysAhead: 3 })
    expect(d?.days.map((x) => [x.offset, x.total])).toEqual([[0, 2], [1, 1], [3, 1]])
    expect(d?.days[2].label).toBe('อีก 3 วัน (15/10)')
    // beyond the window: not listed; today can be switched off
    expect(dailyDigest(more, now, { today: false, daysAhead: 3 })?.days.map((x) => x.offset)).toEqual([1, 3])
    expect(dailyDigest(more, now, { today: true, daysAhead: 99 })?.days.some((x) => x.offset === 18)).toBe(false)
  })
  it('finds due reminders only once', () => {
    const r = (id: string, at: string, extra = {}) => ({ id, title: id, at, done: false, ...extra })
    const list = [r('past', '2026-10-12T08:00'), r('future', '2026-10-12T10:00'), r('fired', '2026-10-12T07:00', { firedAt: 1 }), r('done', '2026-10-12T07:00', { done: true })]
    expect(dueReminders(list, now).map((x) => x.id)).toEqual(['past'])
    expect(localDateTime(now)).toBe('2026-10-12T09:00')
  })
  it('fires the digest once per day after the set time', () => {
    const n = { enabled: true, time: '08:00', today: true, daysAhead: 1, sound: true }
    expect(shouldFireDigest(n, now, null)).toBe(true)
    expect(shouldFireDigest(n, now, '2026-10-12')).toBe(false)
    expect(shouldFireDigest({ ...n, time: '10:00' }, now, null)).toBe(false)
    expect(shouldFireDigest({ ...n, enabled: false }, now, null)).toBe(false)
  })
})

describe('available columns', () => {
  const base = (over: Partial<Shipment> = {}) => make({ customerName: '', customerCode: '', description: '', itemNo: '', qty: 0, unit: '', site: '', ...over })
  it('hides columns that are empty in every row', () => {
    const av = availableFields([base({ so: 'S1', site: 'BP1' }), base({ so: 'S2' })])
    expect(av).toMatchObject({ so: true, site: true, driver: false, truck: false, status: false, customer: false, qty: false })
  })
  it('shows a column as soon as any row has data (e.g. after assigning a driver)', () => {
    const rows = [base({ so: 'S1' }), base({ so: 'S2', driver: 'x' })]
    expect(availableFields(rows).driver).toBe(true)
    expect(availableFields([rows[0]]).driver).toBe(false)
  })
  it('falls back to a group option that has data', () => {
    const av = availableFields([base({ so: 'S1', truckNo: 'เบอร์8' })])
    expect(groupOptions(av)).toEqual(['so', 'truck'])
    expect(effectiveGroupBy('customer', av)).toBe('so')
    expect(effectiveGroupBy('truck', av)).toBe('truck')
    expect(groupOptions(availableFields([]))).toEqual(['customer'])
  })
})

describe('sound', () => {
  it('is a safe no-op where Web Audio does not exist', async () => {
    const { playChime } = await import('./sound')
    expect(await playChime()).toBe(false)
  })
})

describe('shortName / sample', () => {
  it('drops legal prefixes and suffixes but keeps the distinguishing part', async () => {
    const { shortName } = await import('./format')
    expect(shortName('บริษัท มาสด้า โลจิสติกส์ แอนด์ ยูเซ็น(เอเชีย) จำกัด')).toBe('มาสด้า โลจิสติกส์ แอนด์ ยูเซ็น(เอเชีย)')
    expect(shortName('บริษัท วีนิไทย จำกัด(มหาชน)')).toBe('วีนิไทย')
    expect(shortName('หจก. สยามแพ็คเกจจิ้ง')).toBe('สยามแพ็คเกจจิ้ง')
    expect(shortName('Acme Co.')).toBe('Acme Co.')
    expect(shortName('บริษัท จำกัด')).toBe('บริษัท จำกัด') // never returns empty
  })
  it('builds sample data around today with unique ids and valid dates', async () => {
    const { makeSample } = await import('./sample')
    const { parseDate } = await import('./dateParse')
    const rows = makeSample(new Date(2026, 9, 13))
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length)
    expect(rows.every((r) => parseDate(r.date, 'CE') === r.date)).toBe(true)
    expect(rows.some((r) => r.date === '2026-10-13')).toBe(true)
  })
})

describe('theme', () => {
  it('accepts only known themes', async () => {
    const { isTheme } = await import('./theme')
    expect(['system', 'light', 'dark'].every(isTheme)).toBe(true)
    expect(isTheme('blue')).toBe(false)
    expect(isTheme(undefined)).toBe(false)
  })
})

describe('tone colours', () => {
  it('defaults give white text at least WCAG AA contrast', async () => {
    const { DEFAULT_TONES, contrastWithWhite } = await import('./tones')
    for (const t of Object.values(DEFAULT_TONES)) expect(contrastWithWhite(t.color)).toBeGreaterThanOrEqual(4.5)
    expect(contrastWithWhite('#ffffff')).toBeCloseTo(1, 1)
    expect(contrastWithWhite('#000000')).toBeCloseTo(21, 0)
  })
  it('moves untouched old defaults to the new ones but keeps real choices', async () => {
    const { DEFAULT_TONES, migrateToneColor } = await import('./tones')
    expect(migrateToneColor('assigned', '#16a34a')).toBe(DEFAULT_TONES.assigned.color)
    expect(migrateToneColor('pending', '#EA580C')).toBe(DEFAULT_TONES.pending.color)
    expect(migrateToneColor('unassigned', undefined)).toBe(DEFAULT_TONES.unassigned.color)
    expect(migrateToneColor('assigned', '#123456')).toBe('#123456')
  })
})

describe('calendar export and platform', () => {
  it('adds pending reminders as timed events with an alert at the start', () => {
    const now = new Date(2026, 9, 14, 9, 0)
    const rems = [
      { id: 'a', title: 'โทรยืนยัน', at: '2026-10-15T08:00', done: false },
      { id: 'b', title: 'เสร็จแล้ว', at: '2026-10-16T08:00', done: true },
      { id: 'c', title: 'ผ่านไปแล้ว', at: '2026-10-13T08:00', done: false },
    ]
    const ics = toICS([], now, rems)
    expect(ics).toContain('DTSTART:20261015T080000')
    expect(ics).toContain('DTEND:20261015T083000')
    expect(ics).toContain('TRIGGER:PT0S')
    expect(ics).not.toContain('เสร็จแล้ว')
    expect(ics).not.toContain('ผ่านไปแล้ว')
  })
  it('detects iOS (including iPadOS) and gates notifications on Home Screen install', async () => {
    const { detectPlatform, notifyState } = await import('./platform')
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('desktop')
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14)')).toBe('android')
    const base = { hasNotification: false, permission: 'default' as const }
    expect(notifyState({ ...base, platform: 'ios', standalone: false })).toBe('ios-install')
    expect(notifyState({ ...base, platform: 'ios', standalone: true, hasNotification: true })).toBe('default')
    expect(notifyState({ ...base, platform: 'desktop', standalone: false })).toBe('unsupported')
    expect(notifyState({ ...base, platform: 'desktop', standalone: false, hasNotification: true, permission: 'granted' })).toBe('granted')
  })
})
