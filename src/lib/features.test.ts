import { describe, expect, it } from 'vitest'
import { applyFilters, EMPTY, NO_FILTERS, uniqueValues } from './filters'
import { buildGroups } from './group'
import { parseBackup, toBackup, toCSV, toICS, toRows, foldLine, fmtExportDate } from './exporters'
import { addDays, dailyDigest, dueReminders, localDateTime, shouldFireDigest } from './reminders'
import { autoMap, buildShipments } from './mapping'
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
    const d = dailyDigest(rows, now, { today: true, tomorrow: true })
    expect(d?.body).toBe('วันนี้ 2 รายการ (ยังไม่จัดรถ 1) · พรุ่งนี้ 1 รายการ (ยังไม่จัดรถ 1)')
    expect(dailyDigest(rows, now, { today: false, tomorrow: false })).toBeNull()
    expect(dailyDigest([], now, { today: true, tomorrow: true })).toBeNull()
  })
  it('finds due reminders only once', () => {
    const r = (id: string, at: string, extra = {}) => ({ id, title: id, at, done: false, ...extra })
    const list = [r('past', '2026-10-12T08:00'), r('future', '2026-10-12T10:00'), r('fired', '2026-10-12T07:00', { firedAt: 1 }), r('done', '2026-10-12T07:00', { done: true })]
    expect(dueReminders(list, now).map((x) => x.id)).toEqual(['past'])
    expect(localDateTime(now)).toBe('2026-10-12T09:00')
  })
  it('fires the digest once per day after the set time', () => {
    const n = { enabled: true, time: '08:00', today: true, tomorrow: true }
    expect(shouldFireDigest(n, now, null)).toBe(true)
    expect(shouldFireDigest(n, now, '2026-10-12')).toBe(false)
    expect(shouldFireDigest({ ...n, time: '10:00' }, now, null)).toBe(false)
    expect(shouldFireDigest({ ...n, enabled: false }, now, null)).toBe(false)
  })
})
