export type Era = 'BE' | 'CE'
export type EraMode = 'auto' | Era
export type GroupBy = 'customer' | 'so' | 'truck'

export const FIELDS = [
  { key: 'requestedDate', label: 'วันที่ส่ง (Requested)', required: true, match: /requested.*date|ship.*date|วันที่ส่ง/ },
  { key: 'confirmedDate', label: 'วันที่ส่งยืนยัน (Confirmed)', required: false, match: /confirmed.*date|วันที่ยืนยัน/ },
  { key: 'so', label: 'Sales Order', required: false, match: /sales order|journal|^so\b/ },
  { key: 'customerRef', label: 'Customer ref (PO)', required: false, match: /customer ref/ },
  { key: 'customerCode', label: 'รหัสลูกค้า', required: false, match: /^customer$|customer code|รหัสลูกค้า/ },
  { key: 'customerName', label: 'ชื่อลูกค้า', required: false, match: /^name$|customer name|ชื่อลูกค้า/ },
  { key: 'itemNo', label: 'Item number', required: false, match: /item number|item no|รหัสสินค้า/ },
  { key: 'description', label: 'รายละเอียดสินค้า', required: false, match: /description|รายละเอียด/ },
  { key: 'qty', label: 'จำนวน', required: false, match: /quantity|qty|จำนวน/ },
  { key: 'unit', label: 'หน่วย', required: false, match: /^unit$|หน่วย/ },
  { key: 'site', label: 'Site', required: false, match: /from site|^site$/ },
  { key: 'location', label: 'Location', required: false, match: /from location|^location$/ },
  { key: 'remark', label: 'หมายเหตุ', required: false, match: /remark|หมายเหตุ/ },
  { key: 'deliveryOrder', label: 'เลขที่ใบขนส่ง', required: false, match: /delivery order|ใบขนส่ง/ },
  { key: 'driver', label: 'คนขับ', required: false, match: /driver|คนขับ/ },
  { key: 'truckNo', label: 'เลขที่รถ', required: false, match: /licens|truck|เลขที่รถ/ },
  { key: 'plate', label: 'ทะเบียนรถ', required: false, match: /plate|ทะเบียน/ },
  { key: 'status', label: 'สถานะการขนส่ง', required: false, match: /status|สถานะ/ },
] as const

export type FieldKey = (typeof FIELDS)[number]['key']

/** column index in the sheet for each field */
export type Mapping = Partial<Record<FieldKey, number>>

export type Shipment = {
  id: string
  /** effective ship date, ISO yyyy-mm-dd, always Gregorian (CE) */
  date: string
  requestedDate: string
  confirmedDate?: string
  so: string
  customerRef: string
  customerCode: string
  customerName: string
  itemNo: string
  description: string
  qty: number
  unit: string
  site: string
  location: string
  remark: string
  deliveryOrder: string
  driver: string
  truckNo: string
  plate: string
  status: string
  source: string
  /** original columns, header -> value */
  raw: Record<string, unknown>
  /** set when edited in the app; later imports will not overwrite these rows */
  editedAt?: number
}

export type RowError = { row: number; reason: string }

export type ParsedSheet = {
  sheetName: string
  headers: string[]
  rows: unknown[][]
}

export type Filters = { q: string; site: string; status: string; driver: string; customer: string }

/** `at` is a local date-time, 'YYYY-MM-DDTHH:mm' */
export type Reminder = {
  id: string
  title: string
  at: string
  note?: string
  done: boolean
  firedAt?: number
}

export type NotifySettings = { enabled: boolean; time: string; today: boolean; tomorrow: boolean }
