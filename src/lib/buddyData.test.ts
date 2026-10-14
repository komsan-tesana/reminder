import { describe, expect, it } from 'vitest'
import { countAssigned, dataFacts, filterUseKind } from './buddyData'
import { NO_FILTERS } from './filters'
import type { Shipment } from '../types'

const row = (patch: Partial<Shipment>): Shipment => ({ id: Math.random().toString(36).slice(2), date: '2026-10-14', so: 'SO1', customerName: '', customerCode: '', driver: '', truckNo: '', plate: '', ...patch }) as Shipment

describe('buddy: facts read from the data', () => {
  it('counts distinct customers, SO numbers, months and the busiest day', () => {
    const rows = [
      row({ so: 'A', customerName: 'ลูกค้า 1', date: '2026-10-14' }),
      row({ so: 'A', customerName: 'ลูกค้า 1', date: '2026-10-14' }), // same customer and SO again
      row({ so: 'B', customerName: '', customerCode: 'C2', date: '2026-10-14' }), // no name: the code counts
      row({ so: 'C', customerName: 'ลูกค้า 3', date: '2026-11-02' }),
      row({ so: ' ', customerName: '  ', date: '2026-12-31' }), // blanks count as nothing
    ]
    expect(dataFacts(rows)).toEqual({ customers: 3, sos: 3, maxDayRows: 3, months: 3 })
  })

  it('is all zero for no data', () => {
    expect(dataFacts([])).toEqual({ customers: 0, sos: 0, maxDayRows: 0, months: 0 })
  })

  it('contains only numbers, never the data itself', () => {
    const facts = dataFacts([row({ so: 'SECRET-1', customerName: 'ลูกค้าลับ' })])
    expect(JSON.stringify(facts)).not.toMatch(/SECRET|ลูกค้าลับ/)
  })
})

describe('buddy: assigning trucks', () => {
  it('counts rows that had no driver or truck and now have one', () => {
    const a = row({ id: 'a' })
    const b = row({ id: 'b', driver: 'สมชาย' }) // already assigned
    const c = row({ id: 'c' })
    const after = [{ ...a, driver: 'มานะ' }, { ...b, driver: 'ใหม่' }, { ...c, status: 'x' }] as Shipment[]
    expect(countAssigned([a, b, c], after)).toBe(1)
    expect(countAssigned([a], [{ ...a, plate: '71-3040' }])).toBe(1)
    expect(countAssigned([a], [{ ...a, truckNo: '8' }])).toBe(1)
    expect(countAssigned([a], [])).toBe(0) // the row vanished
  })
})

describe('buddy: what counts as using the filter bar', () => {
  it('a dropdown pick counts, clearing one does not', () => {
    expect(filterUseKind(NO_FILTERS, { ...NO_FILTERS, site: 'BP1' })).toBe('pick')
    expect(filterUseKind({ ...NO_FILTERS, site: 'BP1' }, NO_FILTERS)).toBeNull()
    expect(filterUseKind({ ...NO_FILTERS, site: 'BP1' }, { ...NO_FILTERS, site: 'BP4' })).toBe('pick')
  })

  it('typing counts from two characters, and nothing changing counts for nothing', () => {
    expect(filterUseKind(NO_FILTERS, { ...NO_FILTERS, q: 'a' })).toBeNull()
    expect(filterUseKind({ ...NO_FILTERS, q: 'a' }, { ...NO_FILTERS, q: 'ab' })).toBe('search')
    expect(filterUseKind(NO_FILTERS, { ...NO_FILTERS, q: '  ' })).toBeNull()
    expect(filterUseKind({ ...NO_FILTERS, q: 'ab' }, { ...NO_FILTERS, q: '' })).toBeNull()
    expect(filterUseKind(NO_FILTERS, NO_FILTERS)).toBeNull()
  })
})
