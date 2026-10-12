import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import CalendarView from './components/CalendarView'
import DetailPanel from './components/DetailPanel'
import FilterBar from './components/FilterBar'
import Toasts, { type Toast } from './components/Toasts'
import type { ReminderDraft } from './components/ReminderModal'
import { db, editShipments, loadSettings, restoreBackup, saveSettings, type Settings } from './lib/db'
import { applyFilters, NO_FILTERS } from './lib/filters'
import type { Group } from './lib/group'
import { dailyDigest, dueReminders, localDate } from './lib/reminders'
import { systemNotify, useReminderEngine } from './lib/useReminderEngine'
import type { Filters, NotifySettings, Reminder, Shipment } from './types'

// rarely used dialogs are loaded on demand to keep the first load small
const ImportWizard = lazy(() => import('./components/ImportWizard'))
const DataModal = lazy(() => import('./components/DataModal'))
const ReminderModal = lazy(() => import('./components/ReminderModal'))
const EditModal = lazy(() => import('./components/EditModal'))

type Selection = { date: string; key: string | null }
type Dialog = 'import' | 'data' | 'reminders' | null

const latestDate = (items: Shipment[]) => items.reduce<string | null>((m, s) => (!m || s.date > m ? s.date : m), null)

let toastSeq = 0

export default function App() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loaded, setLoaded] = useState(false)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)
  const [editing, setEditing] = useState<Shipment[] | null>(null)
  const [draft, setDraft] = useState<ReminderDraft | null>(null)
  const [focusDate, setFocusDate] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [bannerOff, setBannerOff] = useState(false)

  useEffect(() => {
    Promise.all([db.shipments.toArray(), db.reminders.toArray()]).then(([all, rem]) => {
      setShipments(all)
      setReminders(rem)
      setFocusDate(latestDate(all))
      setLoaded(true)
    })
  }, [])

  const push = useCallback((m: { title: string; body: string }) => setToasts((t) => [...t, { id: ++toastSeq, ...m }]), [])
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id))

  const markFired = useCallback(async (ids: string[]) => {
    const now = Date.now()
    await db.reminders.where('id').anyOf(ids).modify({ firedAt: now })
    setReminders(await db.reminders.toArray())
  }, [])

  useReminderEngine({ ready: loaded, shipments, reminders, notify: settings.notify, push, markFired })

  const visible = useMemo(() => applyFilters(shipments, filters), [shipments, filters])
  const digest = useMemo(
    () => (loaded ? dailyDigest(shipments, new Date(), { today: true, tomorrow: true }) : null),
    [loaded, shipments],
  )
  const dueCount = dueReminders(reminders, new Date()).length

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
  }
  const updateNotify = (notify: NotifySettings) => update({ notify })

  async function afterImport(items: Shipment[], kept: number) {
    setShipments(await db.shipments.toArray())
    setFocusDate(latestDate(items))
    setSelection(null)
    setDialog(null)
    if (kept > 0) push({ title: 'นำเข้าเสร็จ', body: `ข้าม ${kept} รายการที่คุณแก้ไขไว้ในแอป (ไม่ถูกทับ)` })
  }

  async function saveEdit(patch: Partial<Shipment>) {
    if (!editing) return
    const updated = await editShipments(editing.map((r) => r.id), patch)
    const byId = new Map(updated.map((u) => [u.id, u]))
    setShipments((all) => all.map((s) => byId.get(s.id) ?? s))
    // follow the rows if the date moved
    if (patch.date && selection) setFocusDate(patch.date)
    setEditing(null)
  }

  async function restore(data: { shipments: Shipment[]; reminders: Reminder[] }, mode: 'merge' | 'replace') {
    await restoreBackup(data, mode)
    const [all, rem] = await Promise.all([db.shipments.toArray(), db.reminders.toArray()])
    setShipments(all)
    setReminders(rem)
    setFocusDate(latestDate(all))
    setSelection(null)
  }

  async function clearAll() {
    if (!confirm('ลบข้อมูลทั้งหมดในเบราว์เซอร์นี้? (ควรสำรองก่อน)')) return
    await db.transaction('rw', db.shipments, db.reminders, async () => {
      await db.shipments.clear()
      await db.reminders.clear()
    })
    setShipments([])
    setReminders([])
    setSelection(null)
    setDialog(null)
  }

  const addReminder = async (r: Reminder) => {
    await db.reminders.put(r)
    setReminders(await db.reminders.toArray())
  }
  const toggleReminder = async (r: Reminder) => {
    await db.reminders.update(r.id, { done: !r.done })
    setReminders(await db.reminders.toArray())
  }
  const deleteReminder = async (id: string) => {
    await db.reminders.delete(id)
    setReminders(await db.reminders.toArray())
  }

  function testNotify() {
    const d = dailyDigest(shipments, new Date(), settings.notify)
    const m = d ?? { title: 'ทดสอบการแจ้งเตือน', body: 'ไม่มีงานวันนี้/พรุ่งนี้ นี่คือข้อความทดสอบ' }
    systemNotify(m)
    push(m)
  }

  function remindFor(rows: Shipment[], date: string) {
    const so = [...new Set(rows.map((r) => r.so).filter(Boolean))]
    const who = rows[0]?.customerName
    const title = so.length === 1 ? `${so[0]}${who ? ' · ' + who : ''}` : `${rows.length} รายการ${who ? ' · ' + who : ''}`
    setDraft({ title, date })
    setDialog('reminders')
  }

  const todayIso = localDate(new Date())
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
        <button className="primary" onClick={() => setDialog('import')}>
          นำเข้า Excel
        </button>
        <button onClick={() => setDialog('data')}>ส่งออก / สำรอง</button>
        <button onClick={() => { setDraft(null); setDialog('reminders') }}>
          🔔 เตือน{dueCount > 0 && <span className="badge">{dueCount}</span>}
        </button>
      </header>

      {shipments.length > 0 && <FilterBar shipments={shipments} filters={filters} shown={visible.length} onChange={setFilters} />}

      {digest && !bannerOff && (
        <div className="banner" role="status">
          <span>
            📅 {digest.body}
          </span>
          {digest.today.total > 0 && <button onClick={() => { setFocusDate(todayIso); setSelection({ date: todayIso, key: null }) }}>ดูวันนี้</button>}
          <button className="icon" onClick={() => setBannerOff(true)} aria-label="ปิด">
            ✕
          </button>
        </div>
      )}

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
            shipments={visible}
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
            key={`${selection.date}|${selection.key}`}
            date={selection.date}
            groupKeyFilter={selection.key}
            shipments={visible}
            era={settings.era}
            groupBy={settings.groupBy}
            onShowWholeDay={() => setSelection({ date: selection.date, key: null })}
            onEdit={setEditing}
            onRemind={remindFor}
            onClose={() => setSelection(null)}
          />
        )}
      </main>

      <Toasts toasts={toasts} onDismiss={dismiss} />

      <Suspense fallback={null}>
        {dialog === 'import' && <ImportWizard onClose={() => setDialog(null)} onImported={afterImport} />}
        {dialog === 'data' && (
          <DataModal
            all={shipments}
            filtered={visible}
            reminders={reminders}
            groupBy={settings.groupBy}
            onRestore={restore}
            onClear={clearAll}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog === 'reminders' && (
          <ReminderModal
            era={settings.era}
            notify={settings.notify}
            reminders={reminders}
            draft={draft}
            onNotify={updateNotify}
            onAdd={addReminder}
            onToggle={toggleReminder}
            onDelete={deleteReminder}
            onTest={testNotify}
            onClose={() => setDialog(null)}
          />
        )}
        {editing && <EditModal rows={editing} all={shipments} era={settings.era} onSave={saveEdit} onClose={() => setEditing(null)} />}
      </Suspense>
    </div>
  )
}
