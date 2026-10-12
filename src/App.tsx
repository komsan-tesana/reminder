import { useEffect, useState } from 'react'
import CalendarView from './components/CalendarView'
import DetailPanel from './components/DetailPanel'
import ImportWizard from './components/ImportWizard'
import { db, loadSettings, saveSettings, type Settings } from './lib/db'
import type { Group } from './lib/group'
import type { Shipment } from './types'

type Selection = { date: string; key: string | null }

const latestDate = (items: Shipment[]) => items.reduce<string | null>((m, s) => (!m || s.date > m ? s.date : m), null)

export default function App() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loaded, setLoaded] = useState(false)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [importing, setImporting] = useState(false)
  const [focusDate, setFocusDate] = useState<string | null>(null)

  useEffect(() => {
    db.shipments.toArray().then((all) => {
      setShipments(all)
      setFocusDate(latestDate(all))
      setLoaded(true)
    })
  }, [])

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
  }

  async function afterImport(items: Shipment[]) {
    setShipments(await db.shipments.toArray())
    setFocusDate(latestDate(items))
    setSelection(null)
    setImporting(false)
  }

  async function clearAll() {
    if (!confirm('ลบข้อมูลทั้งหมดในเบราว์เซอร์นี้?')) return
    await db.shipments.clear()
    setShipments([])
    setSelection(null)
  }

  const pickGroup = (g: Group) => setSelection({ date: g.date, key: g.key })

  return (
    <div className="app">
      <header className="topbar">
        <h1>Transport Calendar</h1>
        <span className="version" title={`build ${__BUILD_DATE__}`}>
          v{__APP_VERSION__}
        </span>
        <span className="muted">{shipments.length.toLocaleString()} รายการ</span>
        <div className="spacer" />
        <label>
          จัดกลุ่ม
          <select value={settings.groupBy} onChange={(e) => update({ groupBy: e.target.value as Settings['groupBy'] })}>
            <option value="customer">ลูกค้า</option>
            <option value="so">Sales Order</option>
            <option value="truck">รถ</option>
          </select>
        </label>
        <label>
          ปี
          <select value={settings.era} onChange={(e) => update({ era: e.target.value as Settings['era'] })}>
            <option value="BE">พ.ศ.</option>
            <option value="CE">ค.ศ.</option>
          </select>
        </label>
        <button className="primary" onClick={() => setImporting(true)}>
          นำเข้า Excel
        </button>
        {shipments.length > 0 && <button onClick={clearAll}>ล้างข้อมูล</button>}
      </header>

      <main className={selection ? 'with-panel' : ''}>
        <section className="cal">
          {loaded && shipments.length === 0 && (
            <div className="empty">
              ยังไม่มีข้อมูล — กด “นำเข้า Excel” เพื่อเริ่มต้น
              <br />
              <span className="muted small">ข้อมูลถูกเก็บในเบราว์เซอร์นี้เท่านั้น ไม่ส่งไปที่ใด</span>
            </div>
          )}
          <CalendarView
            shipments={shipments}
            era={settings.era}
            groupBy={settings.groupBy}
            focusDate={focusDate}
            onSelectGroup={pickGroup}
            onSelectDate={(date) => setSelection({ date, key: null })}
          />
          <div className="legend">
            <i className="dot tone-assigned" /> จัดรถแล้ว <i className="dot tone-pending" /> ขึ้นค้าง <i className="dot tone-unassigned" /> ยังไม่จัดรถ
          </div>
        </section>
        {selection && (
          <DetailPanel
            date={selection.date}
            groupKeyFilter={selection.key}
            shipments={shipments}
            era={settings.era}
            groupBy={settings.groupBy}
            onShowWholeDay={() => setSelection({ date: selection.date, key: null })}
            onClose={() => setSelection(null)}
          />
        )}
      </main>

      {importing && <ImportWizard onClose={() => setImporting(false)} onImported={afterImport} />}
    </div>
  )
}
