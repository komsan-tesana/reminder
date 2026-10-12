import { useEffect, useMemo, useRef, useState } from 'react'
import { FIELDS, type EraMode, type FieldKey, type Mapping, type ParsedSheet, type Shipment } from '../types'
import { autoMap, buildShipments } from '../lib/mapping'
import { detectEra } from '../lib/dateParse'
import { readWorkbook } from '../lib/readWorkbook'
import { commitImport, loadMapping, saveMapping } from '../lib/db'
import { fmtDate } from '../lib/format'

type Props = {
  onClose: () => void
  onImported: (items: Shipment[], kept: number) => void
}

export default function ImportWizard({ onClose, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [sheet, setSheet] = useState<ParsedSheet | null>(null)
  const [mapping, setMapping] = useState<Mapping>({})
  const [era, setEra] = useState<EraMode>('auto')
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function pick(f: File | undefined) {
    if (!f) return
    setError('')
    setBusy(true)
    try {
      const parsed = await readWorkbook(f)
      if (!parsed.headers.length) throw new Error('ไม่พบหัวตารางในไฟล์')
      const m = loadMapping(parsed.headers) ?? autoMap(parsed.headers)
      setFile(f)
      setSheet(parsed)
      setMapping(m)
      const dateCol = m.confirmedDate ?? m.requestedDate
      if (dateCol !== undefined) {
        const sample = parsed.rows.slice(0, 200).map((r) => r[m.requestedDate ?? dateCol])
        setEra(detectEra(sample) === 'BE' ? 'BE' : 'auto')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const result = useMemo(
    () => (sheet && file ? buildShipments(sheet.headers, sheet.rows, mapping, era, file.name) : null),
    [sheet, file, mapping, era],
  )

  async function confirm() {
    if (!sheet || !result) return
    setBusy(true)
    try {
      saveMapping(sheet.headers, mapping)
      const { kept } = await commitImport(result.items, mode)
      onImported(result.items, kept)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  const setCol = (key: FieldKey, v: string) =>
    setMapping((m) => {
      const next = { ...m }
      if (v === '') delete next[key]
      else next[key] = Number(v)
      return next
    })

  const dateRange = result?.items.length
    ? result.items.reduce(
        (r, s) => ({ min: s.date < r.min ? s.date : r.min, max: s.date > r.max ? s.date : r.max }),
        { min: result.items[0].date, max: result.items[0].date },
      )
    : null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="นำเข้าไฟล์ Excel" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>นำเข้าไฟล์ Excel</h2>
          <button className="icon" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </header>

        {!sheet && (
          <div
            className="drop"
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              pick(e.dataTransfer.files[0])
            }}
          >
            <input ref={input} type="file" accept=".xlsx,.xlsm,.xls,.csv" hidden onChange={(e) => pick(e.target.files?.[0])} />
            {busy ? 'กำลังอ่านไฟล์…' : 'ลากไฟล์ .xlsx มาวาง หรือคลิกเพื่อเลือกไฟล์'}
          </div>
        )}

        {sheet && result && (
          <>
            <p className="muted">
              {file?.name} · sheet “{sheet.sheetName}” · {sheet.rows.length.toLocaleString()} แถว
            </p>

            <h3>จับคู่คอลัมน์</h3>
            <div className="mapgrid">
              {FIELDS.map((f) => (
                <label key={f.key}>
                  <span>
                    {f.label}
                    {f.required && ' *'}
                  </span>
                  <select value={mapping[f.key] ?? ''} onChange={(e) => setCol(f.key, e.target.value)}>
                    <option value="">— ไม่ใช้ —</option>
                    {sheet.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `(คอลัมน์ ${i + 1})`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>

            <div className="options">
              <label>
                ปีในไฟล์ (ข้อความวันที่)
                <select value={era} onChange={(e) => setEra(e.target.value as EraMode)}>
                  <option value="auto">ตรวจอัตโนมัติ</option>
                  <option value="CE">ค.ศ.</option>
                  <option value="BE">พ.ศ.</option>
                </select>
              </label>
              <label>
                วิธีนำเข้า
                <select value={mode} onChange={(e) => setMode(e.target.value as 'merge' | 'replace')}>
                  <option value="merge">รวมกับข้อมูลเดิม (ตัวซ้ำถูกอัปเดต)</option>
                  <option value="replace">แทนที่ข้อมูลเดิมทั้งหมด</option>
                </select>
              </label>
            </div>

            <div className={`summary ${mapping.requestedDate === undefined ? 'bad' : ''}`}>
              {mapping.requestedDate === undefined ? (
                'กรุณาเลือกคอลัมน์วันที่ส่ง'
              ) : (
                <>
                  ใช้ได้ <b>{result.items.length.toLocaleString()}</b> แถว
                  {dateRange && ` · ${fmtDate(dateRange.min, 'CE', 'D MMM YYYY')} – ${fmtDate(dateRange.max, 'CE', 'D MMM YYYY')} (ค.ศ.)`}
                  {result.errors.length > 0 && (
                    <span className="warn"> · ข้าม {result.errors.length.toLocaleString()} แถวที่วันที่ผิด</span>
                  )}
                </>
              )}
            </div>

            {result.errors.length > 0 && (
              <details>
                <summary>แถวที่ถูกข้าม (แสดง 20 แถวแรก)</summary>
                <ul className="small">
                  {result.errors.slice(0, 20).map((e) => (
                    <li key={e.row}>
                      แถว {e.row}: {e.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="table-wrap preview">
              <table>
                <thead>
                  <tr>
                    <th>วันที่ (ค.ศ.)</th>
                    <th>SO</th>
                    <th>ลูกค้า</th>
                    <th>สินค้า</th>
                    <th className="num">จำนวน</th>
                    <th>คนขับ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.slice(0, 8).map((s) => (
                    <tr key={s.id}>
                      <td>{s.date}</td>
                      <td>{s.so}</td>
                      <td>{s.customerName || s.customerCode}</td>
                      <td className="clip">{s.description}</td>
                      <td className="num">{s.qty}</td>
                      <td>{s.driver}</td>
                      <td>{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {error && <p className="warn">{error}</p>}

        <footer>
          {sheet && (
            <button
              onClick={() => {
                setSheet(null)
                setFile(null)
              }}
            >
              เลือกไฟล์ใหม่
            </button>
          )}
          <button onClick={onClose}>ยกเลิก</button>
          <button className="primary" disabled={busy || !result || result.items.length === 0 || mapping.requestedDate === undefined} onClick={confirm}>
            {busy ? 'กำลังบันทึก…' : `นำเข้า ${result?.items.length.toLocaleString() ?? ''} รายการ`}
          </button>
        </footer>
      </div>
    </div>
  )
}
