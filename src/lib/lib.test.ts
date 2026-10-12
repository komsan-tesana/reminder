import { describe, expect, it } from 'vitest'
import { detectEra, parseDate } from './dateParse'
import { autoMap, buildShipments } from './mapping'

describe('parseDate', () => {
  it('converts Excel serial numbers', () => {
    expect(parseDate(44446)).toBe('2021-09-07')
    expect(parseDate('44446')).toBe('2021-09-07')
  })
  it('reads ISO and day-first text', () => {
    expect(parseDate('2026-10-12')).toBe('2026-10-12')
    expect(parseDate('12/10/2026')).toBe('2026-10-12')
  })
  it('converts Buddhist years, auto or forced', () => {
    expect(parseDate('12/10/2569')).toBe('2026-10-12')
    expect(parseDate('2569-10-12', 'auto')).toBe('2026-10-12')
    expect(parseDate('12/10/2569', 'BE')).toBe('2026-10-12')
  })
  it('rejects invalid or out-of-range dates', () => {
    expect(parseDate('31/02/2026')).toBeNull()
    expect(parseDate('12/10/2569', 'CE')).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate('abc')).toBeNull()
  })
  it('detects era', () => {
    expect(detectEra(['12/10/2569'])).toBe('BE')
    expect(detectEra(['12/10/2026', 44446])).toBe('CE')
  })
})

describe('mapping', () => {
  const headers = [
    'Requested ship date', 'Confirmed ship date', 'Sales Order / Journal Number', 'Customer reference',
    'Customer', 'Name', 'Item number', 'Product Description', 'Quantity', 'Unit', 'From Site', 'From Location',
    'From Warehouse', 'Remark', 'Delivery order(เลขที่ใบขนส่ง)', 'Driver name(ชื่อคนขับ)',
    'Licens Truck(เลขที่รถ)', 'Mode of delivery(ทะเบียนรถ)', 'Status delivery(สถานะการขนส่ง)', 'Update',
  ]
  it('auto-maps the BPC transport headers', () => {
    const m = autoMap(headers)
    expect(m).toMatchObject({
      requestedDate: 0, confirmedDate: 1, so: 2, customerRef: 3, customerCode: 4, customerName: 5,
      itemNo: 6, description: 7, qty: 8, unit: 9, site: 10, location: 11, remark: 13,
      deliveryOrder: 14, driver: 15, truckNo: 16, plate: 17, status: 18,
    })
  })
  it('builds shipments, prefers confirmed date, reports bad rows, keeps identical lines', () => {
    const row = [44446, 44450, 'SO1', '', 'C1', 'Acme', 'I1', 'Pallet', 40, 'Pcs', 'BP1', '', '', '', '', '', '', '', '', 'No']
    const bad = ['xx', '', 'SO2', ...Array(17).fill('')]
    const { items, errors } = buildShipments(headers, [row, row, bad], autoMap(headers), 'auto', 'f.xlsx')
    expect(items).toHaveLength(2)
    expect(items[0].date).toBe('2021-09-11')
    expect(items[0].requestedDate).toBe('2021-09-07')
    expect(items[0].id).not.toBe(items[1].id)
    expect(errors).toEqual([{ row: 4, reason: 'วันที่ไม่ถูกต้องหรือว่าง' }])
  })
})
