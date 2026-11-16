import { describe, expect, it } from 'vitest'
import { findDates, findPlanRefs, findPoDate, findTotal, poCandidates, readPo } from './poRead'
import { matchPo } from './poMatch'
import type { Shipment } from '../types'

// synthetic stand-ins for three very different customer layouts
const DEXTRA = `Dextra Manufacturing Co Ltd.
*PO073139*
Purchase Order No. : PO073139
Purchase Order Date : 16/11/2026
1 GACC1900063 C PCS 300.00 870.0000 261,000.00 11/12/2026`
const OHLINS = `Ohlins Asia Co., Ltd.
Purchase Order
Our Order Date Purchase Order No
26400610/11/26
Created:
10/11/26
Total Amount ( THB ) 69,443.00
Total Tax Amount 4,543.00`
const ELUX = `Order No 26011272 OP Date: 16-11-2026
Supplier 1225323 BURANAPAGROUP CO.,LTD.
TOTAL ORDER 7,710.00 THB
Total Gross Amount 8,249.70 THB
23-11-2026 423.00`

describe('PO number detection', () => {
  it('reads labelled numbers on the same line', () => {
    expect(poCandidates('PO073139_PO073139-2.pdf', DEXTRA)[0]).toBe('PO073139')
    expect(poCandidates('26011272 .pdf', ELUX)[0]).toBe('26011272')
  })
  it('splits a PO number glued to a date on the next line', () => {
    expect(poCandidates('264006 BURANAPA GROUP COMPANY LIMITED.pdf', OHLINS)[0]).toBe('264006')
  })
  it('prefers a reference that already exists in the plan', () => {
    const r = readPo('x.pdf', ELUX, ['26011272', 'ZZZ-99999'])
    expect(r.poNo).toBe('26011272')
    expect(r.planHit).toBe(true)
  })
  it('flags a plan reference glued to other characters as weak', () => {
    const h = findPlanRefs('a.pdf', OHLINS, ['264006'])
    expect(h.strong).toEqual([])
    expect(h.weak).toEqual(['264006'])
  })
  it('ignores short references that would match anything', () => {
    expect(findPlanRefs('a.pdf', 'page 1 of 2 1234', ['1', '12', '1234']).strong).toEqual([])
  })
})

describe('noise handling', () => {
  it('drops a leading label from the issuer and small plain numbers from candidates', () => {
    expect(readPo('x.pdf', 'Ship To: ACME CO. LTD\nPurchase Order No: AB12345\nsize 1166 mm', []).issuer).toBe('ACME CO. LTD')
    expect(poCandidates('x.pdf', 'Purchase Order No: AB12345\nOrder No 1166')).not.toContain('1166')
  })
})

describe('best-effort facts', () => {
  it('finds dates in several formats', () => {
    expect(findDates('16/11/2026 and 10-12-26 and 12-Nov-2026 and 2026-01-05')).toEqual(['2026-01-05', '2026-11-12', '2026-11-16', '2026-12-10'])
  })
  it('treats Buddhist years', () => expect(findDates('16/11/2569')).toEqual(['2026-11-16']))
  it('finds the PO date next to its label', () => {
    expect(findPoDate(DEXTRA)).toBe('2026-11-16')
    expect(findPoDate(ELUX)).toBe('2026-11-16')
  })
  it('finds the total, not the tax', () => {
    expect(findTotal(OHLINS)).toEqual({ total: 69443, currency: 'THB' })
    expect(findTotal(ELUX).total).toBe(8249.7)
  })
})

describe('matchPo', () => {
  const row = (over: Partial<Shipment>): Shipment =>
    ({ id: 'a', date: '2026-12-11', customerRef: 'PO073139', qty: 300, driver: '', truckNo: '', plate: '', ...over }) as Shipment
  const po = { poNo: 'po-073139', poDate: '2026-11-16', dates: ['2026-11-16', '2026-12-11'] }
  it('matches ignoring case and punctuation, and sums quantity', () => {
    const m = matchPo(po, [row({}), row({ id: 'b', qty: 100, driver: 'x' }), row({ id: 'c', customerRef: 'OTHER1' })])
    expect(m.status).toBe('planned')
    expect(m.rows).toHaveLength(2)
    expect(m.qty).toBe(400)
    expect(m.assigned).toBe(1)
  })
  it('matches one PO inside a multi-PO cell', () => {
    expect(matchPo(po, [row({ customerRef: 'AAA111, PO073139' })]).status).toBe('planned')
  })
  it('reports missing and mismatched dates', () => {
    expect(matchPo(po, []).status).toBe('unplanned')
    expect(matchPo(po, [row({ date: '2027-01-30' })]).status).toBe('check')
    expect(matchPo({ ...po, poNo: '' }, [row({})]).status).toBe('nokey')
  })
})

describe('poMarks', () => {
  it('maps plan rows and days to imported POs', async () => {
    const { poMarks } = await import('./poMatch')
    const r = (id: string, date: string, ref: string) => ({ id, date, customerRef: ref }) as Shipment
    const m = poMarks(['po-073139', 'TAPR260214'], [r('a', '2026-12-11', 'PO073139'), r('b', '2026-12-11', 'PO073139'), r('c', '2026-12-12', 'X1, TAPR260214'), r('d', '2026-12-13', 'OTHER9')])
    expect(m.byDate.get('2026-12-11')).toEqual(['po-073139'])
    expect(m.byDate.get('2026-12-12')).toEqual(['TAPR260214'])
    expect(m.byDate.has('2026-12-13')).toBe(false)
    expect(m.byRow.get('a')).toBe('po-073139')
  })
})
