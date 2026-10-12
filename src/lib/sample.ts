import { addDays, localDate } from './reminders'
import type { Shipment } from '../types'

const CUSTOMERS = [
  ['C-001', 'บริษัท เอบีซี โลจิสติกส์ จำกัด'],
  ['C-002', 'บริษัท ตัวอย่างอุตสาหกรรม จำกัด (มหาชน)'],
  ['C-003', 'หจก. สยามแพ็คเกจจิ้ง'],
  ['C-004', 'บริษัท เดโม่ ฟู้ดส์ จำกัด'],
] as const
const ITEMS = ['Wooden pallet 1000x1000 mm', 'Wooden frame 75x1130 mm', 'Pallet 1200x1000 mm [4 ทาง]', 'Crate 800x600 mm']
const DRIVERS = ['สมชาย ใจดี', 'มานะ บุญยัง']

/** Small made-up data set around today, so a new user can see the calendar before importing. */
export function makeSample(today = new Date()): Shipment[] {
  const base = localDate(today)
  const out: Shipment[] = []
  let n = 0
  for (let offset = -3; offset <= 8; offset++) {
    const perDay = 1 + ((offset + 3) % 3)
    for (let i = 0; i < perDay; i++, n++) {
      const [code, name] = CUSTOMERS[n % CUSTOMERS.length]
      const date = addDays(base, offset)
      const assigned = n % 3 !== 0
      const so = `SO-DEMO-${String(100 + n)}`
      out.push({
        id: `sample-${n}`,
        date,
        requestedDate: date,
        so,
        customerRef: '',
        customerCode: code,
        customerName: name,
        itemNo: `I-${n % 4}`,
        description: ITEMS[n % ITEMS.length],
        qty: 20 * (1 + (n % 5)),
        unit: 'Pcs',
        site: n % 2 ? 'BP1' : 'BP4',
        location: '',
        remark: '',
        deliveryOrder: '',
        driver: assigned ? DRIVERS[n % DRIVERS.length] : '',
        truckNo: assigned ? `เบอร์${8 + (n % 2)}` : '',
        plate: assigned ? '71-3040' : '',
        status: n % 7 === 0 ? 'ขึ้นค้าง' : assigned ? 'เที่ยวที่1' : '',
        source: 'ตัวอย่าง',
        raw: {},
      })
    }
  }
  return out
}
