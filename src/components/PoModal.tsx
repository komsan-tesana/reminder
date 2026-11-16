import { useMemo, useRef, useState } from 'react'
import Modal from './Modal'
import { db } from '../lib/db'
import { fmtDate, fmtQty } from '../lib/format'
import { matchPo, PO_STATUS_LABEL, rowsForPo, type PoStatus } from '../lib/poMatch'
import { planRefsOf, poKey, readPo } from '../lib/poRead'
import type { Era, PoRecord, Shipment } from '../types'

type Draft = {
  key: string
  file: File
  text: string
  ocr: boolean
  poNo: string
  candidates: string[]
  planHit: boolean
  issuer: string
  poDate: string
  dates: string[]
  total: number | null
  currency: string
}

type Props = {
  /** imported POs and a way to re-read them after a change; App owns them so the calendar can mark matching days */
  items: PoRecord[]
  onChanged: () => void
  shipments: Shipment[]
  era: Era
  /** jump the calendar to a plan date */
  onJump: (date: string) => void
  onClose: () => void
}

const fileId = (f: File) => `${f.name.toLowerCase()}|${f.size}`
const TONE: Record<PoStatus, string> = { planned: 'text-[var(--assigned)]', check: 'text-[var(--warn)]', unplanned: 'text-[var(--pending)]', nokey: 'text-muted' }
const ORDER: PoStatus[] = ['planned', 'check', 'unplanned', 'nokey']

export default function PoModal({ items, onChanged, shipments, era, onJump, onClose }: Props) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [filter, setFilter] = useState<PoStatus | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const reload = async () => onChanged()

  const rows = useMemo(
    () => items.map((po) => ({ po, m: matchPo(po, shipments) })).sort((a, b) => b.po.importedAt - a.po.importedAt),
    [items, shipments],
  )
  const counts = useMemo(() => {
    const c: Record<PoStatus, number> = { planned: 0, check: 0, unplanned: 0, nokey: 0 }
    for (const r of rows) c[r.m.status]++
    return c
  }, [rows])
  const shown = filter ? rows.filter((r) => r.m.status === filter) : rows
  const current = rows.find((r) => r.po.id === selected) ?? null

  async function pick(list: FileList | File[] | null) {
    const files = [...(list ?? [])].filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf')
    if (!files.length) {
      if (list?.length) setError('รองรับเฉพาะไฟล์ PDF')
      return
    }
    setError('')
    const refs = planRefsOf(shipments)
    const out: Draft[] = []
    try {
      const { readPdfText } = await import('../lib/poPdf')
      for (const [i, file] of files.entries()) {
        setBusy(`กำลังอ่าน ${file.name} (${i + 1}/${files.length})…`)
        try {
          const { text, ocr } = await readPdfText(file, (m) => setBusy(`${file.name}: ${m}`))
          out.push({ key: fileId(file), file, text, ocr, ...readPo(file.name, text, refs) })
        } catch (e) {
          setError(`อ่าน ${file.name} ไม่ได้: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    } finally {
      setBusy('')
      if (input.current) input.current.value = ''
    }
    if (out.length) setDrafts(out)
  }

  async function saveDrafts() {
    if (!drafts) return
    await db.pos.bulkPut(
      drafts.map<PoRecord>((d) => ({
        id: d.key,
        fileName: d.file.name,
        poNo: d.poNo.trim(),
        candidates: d.candidates,
        issuer: d.issuer,
        poDate: d.poDate,
        dates: d.dates,
        total: d.total,
        currency: d.currency,
        text: d.text.slice(0, 40000),
        ocr: d.ocr,
        importedAt: Date.now(),
        file: d.file,
      })),
    )
    setSelected(drafts[0].key)
    setDrafts(null)
    await reload()
  }

  async function setPoNo(id: string, poNo: string) {
    await db.pos.update(id, { poNo: poNo.trim() })
    await reload()
  }
  async function remove(id: string) {
    if (!window.confirm('ลบ PO นี้ออกจากรายการ? (ไม่กระทบ plan)')) return
    await db.pos.delete(id)
    setSelected(null)
    await reload()
  }
  function openPdf(po: PoRecord) {
    const url = URL.createObjectURL(po.file)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const fd = (d: string) => (d ? fmtDate(d, era, 'D MMM YYYY') : '-')

  // ---- step 2: confirm what was read ----
  if (drafts) {
    return (
      <Modal
        title={`ตรวจเลข PO ก่อนบันทึก (${drafts.length} ไฟล์)`}
        onClose={() => setDrafts(null)}
        wide
        footer={
          <>
            <button onClick={() => setDrafts(null)}>ยกเลิก</button>
            <button className="primary" onClick={saveDrafts}>
              บันทึก
            </button>
          </>
        }
      >
        <p className="muted small">
          เลข PO คือสิ่งที่ใช้จับคู่กับช่อง Customer reference ใน plan ตรวจให้ถูกต้อง หรือกดเลือกจากตัวเลือกที่ระบบเจอ
        </p>
        <div className="flex flex-col gap-3">
          {drafts.map((d, i) => {
            const n = rowsForPo(d.poNo, shipments).length
            return (
              <div key={d.key} className="rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="break-all">{d.file.name}</strong>
                  {d.ocr && <span className="muted small">อ่านด้วย OCR · ควรตรวจตัวเลขซ้ำ</span>}
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <label>
                    เลข PO
                    <input value={d.poNo} onChange={(e) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, poNo: e.target.value } : x)))} />
                  </label>
                  <span className={n ? 'text-[var(--assigned)]' : 'warn'}>
                    {!poKey(d.poNo) ? 'ยังไม่ระบุเลข PO' : n ? `พบใน plan ${n} แถว` : 'ไม่พบใน plan'}
                  </span>
                </div>
                {d.candidates.length > 1 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <span className="muted small">ตัวเลือก:</span>
                    {d.candidates.map((c) => (
                      <button key={c} onClick={() => setDrafts(drafts.map((x, j) => (j === i ? { ...x, poNo: c } : x)))}>
                        {c}
                      </button>
                    ))}
                  </div>
                )}
                <div className="muted small mt-2">
                  {d.issuer || 'ไม่พบชื่อผู้ออก PO'} · วันที่ PO {fd(d.poDate)}
                  {d.total != null && ` · ยอดรวม ${fmtQty(d.total)} ${d.currency}`}
                </div>
              </div>
            )
          })}
        </div>
      </Modal>
    )
  }

  // ---- step 1: list + detail ----
  return (
    <Modal title="นำเข้า PO · เทียบกับ plan" onClose={onClose} xl>
      <div className="flex min-h-0 flex-1 flex-col gap-2">
      <input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={(e) => pick(e.target.files)} />
      <div
        className="drop"
        style={{ margin: 0, padding: items.length ? '14px 16px' : '48px 16px', borderColor: over ? 'var(--accent)' : undefined, cursor: busy ? 'progress' : undefined }}
        onClick={() => !busy && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          if (!busy) void pick(e.dataTransfer.files)
        }}
      >
        {busy || 'ลากไฟล์ PDF ของ PO มาวางที่นี่ (หลายไฟล์ได้) หรือคลิกเพื่อเลือกไฟล์'}
        {error && <div className="warn small mt-1">{error}</div>}
      </div>
      <p className="muted small">
        เลข PO จาก PDF จะถูกจับคู่กับช่อง <b>Customer reference</b> ของ plan · ไฟล์อ่านในเครื่องนี้เท่านั้น ไม่ถูกส่งออกไปไหน
      </p>

      {items.length === 0 ? (
        <div className="muted py-10 text-center">ยังไม่มี PO ที่นำเข้า</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {ORDER.map((s) => (
              <button key={s} aria-pressed={filter === s} className={filter === s ? 'primary' : ''} onClick={() => setFilter(filter === s ? null : s)}>
                {PO_STATUS_LABEL[s]} · {counts[s]}
              </button>
            ))}
          </div>
          <div className="table-wrap min-h-[120px] flex-[2]">
            <table>
              <thead>
                <tr>
                  <th>เลข PO</th>
                  <th>ผู้ออก PO</th>
                  <th>วันที่ PO</th>
                  <th>ยอดรวม</th>
                  <th>ใน plan</th>
                  <th>สถานะ</th>
                  <th className="w-10">ลบ</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ po, m }) => (
                  <tr key={po.id} className={po.id === selected ? 'sel' : ''} onClick={() => setSelected(po.id)} style={{ cursor: 'pointer' }}>
                    <td>
                      <b>{po.poNo || '-'}</b>
                    </td>
                    <td>{po.issuer || '-'}</td>
                    <td className="nw">{fd(po.poDate)}</td>
                    <td className="nw">{po.total != null ? `${fmtQty(po.total)} ${po.currency}` : '-'}</td>
                    <td className="nw">{m.rows.length ? `${m.rows.length} แถว · ${fd(m.planDates[0])}${m.planDates.length > 1 ? ` +${m.planDates.length - 1}` : ''}` : '-'}</td>
                    <td className={`nw ${TONE[m.status]}`}>{PO_STATUS_LABEL[m.status]}</td>
                    <td>
                      <button className="icon" aria-label={`ลบ PO ${po.poNo || po.fileName}`} title="ลบ PO นี้" onClick={(e) => { e.stopPropagation(); void remove(po.id) }}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {current && (
        <section className="grid min-h-[220px] flex-[3] gap-3 md:grid-cols-2">
          <div className="min-h-0 overflow-auto rounded-lg border border-line p-3">
            <h3 className="m-0 mb-2 text-sm">ข้อมูลจาก PO</h3>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="muted">ไฟล์</dt>
              <dd className="m-0 break-all">{current.po.fileName}{current.po.ocr ? ' (OCR)' : ''}</dd>
              <dt className="muted">เลข PO</dt>
              <dd className="m-0">
                <input key={current.po.id} defaultValue={current.po.poNo} onBlur={(e) => e.target.value.trim() !== current.po.poNo && setPoNo(current.po.id, e.target.value)} />
              </dd>
              <dt className="muted">ผู้ออก PO</dt>
              <dd className="m-0">{current.po.issuer || '-'}</dd>
              <dt className="muted">วันที่ PO</dt>
              <dd className="m-0">{fd(current.po.poDate)}</dd>
              <dt className="muted">วันที่ใน PO</dt>
              <dd className="m-0">{current.po.dates.map((d) => fd(d)).join(' · ') || '-'}</dd>
              <dt className="muted">ยอดรวม</dt>
              <dd className="m-0">{current.po.total != null ? `${fmtQty(current.po.total)} ${current.po.currency}` : '-'}</dd>
            </dl>
            {current.po.candidates.length > 1 && (
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="muted small">เลข PO อื่นที่เป็นไปได้:</span>
                {current.po.candidates.filter((c) => poKey(c) !== poKey(current.po.poNo)).map((c) => (
                  <button key={c} onClick={() => setPoNo(current.po.id, c)}>
                    {c}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <button onClick={() => openPdf(current.po)}>เปิด PDF</button>
              <button onClick={() => remove(current.po.id)}>ลบ</button>
            </div>
            <details className="mt-2">
              <summary className="muted small cursor-pointer">ข้อความที่อ่านได้</summary>
              <pre className="small mt-1 max-h-48 overflow-auto whitespace-pre-wrap">{current.po.text}</pre>
            </details>
          </div>

          <div className="flex min-h-0 flex-col rounded-lg border border-line p-3">
            <h3 className="m-0 mb-2 text-sm">
              ใน plan <span className={TONE[current.m.status]}>{PO_STATUS_LABEL[current.m.status]}</span>
            </h3>
            {current.m.note && <p className="warn small m-0 mb-2">{current.m.note}</p>}
            {current.m.rows.length > 0 && (
              <p className="muted small m-0 mb-2">
                {current.m.rows.length} แถว · จำนวนรวม {fmtQty(current.m.qty)} · จัดรถแล้ว {current.m.assigned}/{current.m.rows.length}
              </p>
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>วันที่ส่ง</th>
                    <th>SO</th>
                    <th>ลูกค้า</th>
                    <th>สินค้า</th>
                    <th>จำนวน</th>
                    <th>รถ / คนขับ</th>
                  </tr>
                </thead>
                <tbody>
                  {current.m.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="nw">
                        <button className="!border-0 !bg-transparent !p-0 !text-accent underline" onClick={() => { onJump(r.date); onClose() }} title="ไปที่วันนี้บนปฏิทิน">
                          {fd(r.date)}
                        </button>
                      </td>
                      <td className="nw">{r.so}</td>
                      <td>{r.customerName}</td>
                      <td>{r.description || r.itemNo}</td>
                      <td className="nw">{fmtQty(r.qty)} {r.unit}</td>
                      <td>{[r.plate || r.truckNo, r.driver].filter(Boolean).join(' / ') || <span className="muted">ยังไม่จัดรถ</span>}</td>
                    </tr>
                  ))}
                  {!current.m.rows.length && (
                    <tr>
                      <td colSpan={6} className="muted">
                        ไม่มีแถวใน plan ที่ Customer reference ตรงกับ "{current.po.poNo || '-'}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
      </div>
    </Modal>
  )
}
