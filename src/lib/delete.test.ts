import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Shipment } from '../types'

const row = (id: string, extra: Partial<Shipment> = {}): Shipment => ({ id, date: '2026-03-01', so: id, item: 'x', qty: 1, ...extra }) as Shipment

describe('deleting shipments', () => {
  beforeEach(async () => {
    const { db } = await import('./db')
    await Promise.all([db.shipments.clear(), db.deleted.clear()])
  })

  it('removes rows, and a merge import does not bring them back', async () => {
    const { db, deleteShipments, commitImport } = await import('./db')
    await db.shipments.bulkPut([row('a'), row('b')])
    await deleteShipments(['a'])
    expect((await db.shipments.toArray()).map((r) => r.id)).toEqual(['b'])
    const res = await commitImport([row('a'), row('b'), row('c')], 'merge')
    expect(res.removed).toBe(1)
    expect((await db.shipments.toArray()).map((r) => r.id).sort()).toEqual(['b', 'c'])
  })

  it('a replace import forgets earlier deletions', async () => {
    const { db, deleteShipments, commitImport } = await import('./db')
    await db.shipments.bulkPut([row('a')])
    await deleteShipments(['a'])
    await commitImport([row('a')], 'replace')
    expect((await db.shipments.toArray()).map((r) => r.id)).toEqual(['a'])
    expect(await db.deleted.count()).toBe(0)
  })

  it('reports how many rows were new, so re-importing the same file adds none', async () => {
    const { db, commitImport, deleteShipments } = await import('./db')
    const file = [row('a'), row('b'), row('c')]
    expect((await commitImport(file, 'merge')).added).toBe(3)
    expect((await commitImport(file, 'merge')).added).toBe(0) // the same file again
    expect((await commitImport([...file, row('d')], 'merge')).added).toBe(1)
    expect((await commitImport(file, 'replace')).added).toBe(0) // replacing with rows that were all there already
    await deleteShipments(['a'])
    expect((await commitImport(file, 'merge')).added).toBe(0) // a deleted row is not "new" either
    await db.shipments.clear()
    expect((await commitImport(file, 'replace')).added).toBe(3)
  })
})
