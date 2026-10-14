import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import CalendarView from './components/CalendarView'
import DetailPanel from './components/DetailPanel'
import FilterBar from './components/FilterBar'
import BottomSheet from './components/BottomSheet'
import ResizeHandle, { EDGE_W, MAX_VH, type PanelSize } from './components/ResizeHandle'
import { toast } from 'sonner'
import Toasts from './components/Toasts'
import type { ReminderDraft } from './components/ReminderModal'
import { db, deleteShipments, editShipments, loadPanelSize, loadSettings, restoreBackup, savePanelSize, saveSettings, type Settings } from './lib/db'
import { availableFields, effectiveGroupBy, groupOptions } from './lib/available'
import { applyFilters, NO_FILTERS } from './lib/filters'
import type { Group, Tone } from './lib/group'
import { dailyDigest, dueReminders } from './lib/reminders'
import { fmtDate } from './lib/format'
import { playChime } from './lib/sound'
import { applyTheme, THEME_LABEL } from './lib/theme'
import { makeSample } from './lib/sample'
import { systemNotify, useReminderEngine } from './lib/useReminderEngine'
import { buildPushPlan } from './lib/pushPlan'
import { disablePush, enablePush, pushState, syncPush, testPush, type PushState } from './lib/push'
import { countPendingReminders, pushAction, pushWanted, shouldAutoSubscribe } from './lib/pushStatus'
import type { PushPlan } from './lib/pushPlan'
import type { Filters, NotifySettings, Reminder, Shipment } from './types'

// rarely used dialogs are loaded on demand to keep the first load small
const ImportWizard = lazy(() => import('./components/ImportWizard'))
const DataModal = lazy(() => import('./components/DataModal'))
const ReminderModal = lazy(() => import('./components/ReminderModal'))
const NotifyModal = lazy(() => import('./components/NotifyModal'))
const EditModal = lazy(() => import('./components/EditModal'))
const SettingsModal = lazy(() => import('./components/SettingsModal'))

type Selection = { date: string; key: string | null }
type Dialog = 'import' | 'data' | 'reminders' | 'notify' | 'settings' | null

/** The data date closest to today, so the calendar opens where the action is (not the file's last row). */
function nearestDate(items: Shipment[]): string | null {
  const today = Date.now()
  let best: string | null = null
  let bestGap = Infinity
  for (const s of items) {
    const gap = Math.abs(new Date(s.date).getTime() - today)
    if (gap < bestGap) {
      best = s.date
      bestGap = gap
    }
  }
  return best
}

/** true while the media query matches */
function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}


const GROUP_LABEL = { customer: 'ลูกค้า', so: 'Sales Order', truck: 'รถ' } as const

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
  const [bannerOff, setBannerOff] = useState(false)
  const [panelSize, setPanelSize] = useState<PanelSize>(loadPanelSize)
  const stacked = useMedia('(max-width: 820px)')
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    Promise.all([db.shipments.toArray(), db.reminders.toArray()]).then(([all, rem]) => {
      setShipments(all)
      setReminders(rem)
      setFocusDate(nearestDate(all))
      setLoaded(true)
    })
  }, [])

  const push = useCallback((m: { title: string; body: string }) => void toast(m.title, { description: m.body }), [])

  const markFired = useCallback(async (ids: string[]) => {
    const now = Date.now()
    await db.reminders.where('id').anyOf(ids).modify({ firedAt: now })
    setReminders(await db.reminders.toArray())
  }, [])

  // ---- Web Push (optional: needs the Worker in /worker) ----
  const [pushSt, setPushSt] = useState<PushState>('unconfigured')
  const [pushMsg, setPushMsg] = useState('')
  const [pushBusy, setPushBusy] = useState(false)
  useEffect(() => {
    pushState().then(setPushSt)
  }, [])
  const pushPlan = useMemo(() => buildPushPlan(shipments, reminders, settings.notify, new Date()), [shipments, reminders, settings.notify])
  const planRef = useRef(pushPlan)
  planRef.current = pushPlan

  // `override` lets a caller sync a plan built from settings that React has not rendered yet
  const doPushSync = useCallback(async (override?: PushPlan) => {
    try {
      const n = await syncPush(override ?? planRef.current)
      setPushMsg(`ซิงก์ล่าสุด ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · ปลุกตามเวลา ${n} ครั้งข้างหน้า`)
    } catch (e) {
      setPushMsg(`ซิงก์ไม่สำเร็จ: ${e instanceof Error ? e.message : e} (จะลองใหม่เมื่อข้อมูลเปลี่ยนหรือเปิดแอปอีกครั้ง)`)
    }
  }, [])

  // keep the server's wake-up times in step with the data: after changes, and when the app comes back
  useEffect(() => {
    if (!loaded || pushSt !== 'on') return
    const t = setTimeout(() => void doPushSync(), 3000)
    return () => clearTimeout(t)
  }, [loaded, pushSt, pushPlan, doPushSync])
  useEffect(() => {
    if (pushSt !== 'on') return
    const onVisible = () => document.visibilityState === 'visible' && void doPushSync()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [pushSt, doPushSync])

  // Push is not a separate setting. It is wanted while the daily summary is on OR a reminder is
  // waiting. Turning the summary on asks for permission and subscribes (this runs inside the click,
  // which iOS requires for the prompt); turning it off unsubscribes unless reminders still need it.
  // The in-app summary and reminders work either way.
  async function toggleDigest(on: boolean) {
    const notify = { ...settings.notify, enabled: on }
    update({ notify })
    const action = pushAction(pushSt, pushWanted(on, countPendingReminders(reminders)))
    if (action === 'none') return
    setPushBusy(true)
    setPushMsg('')
    try {
      if (action === 'subscribe') {
        await enablePush()
        setPushSt(await pushState())
        await doPushSync(buildPushPlan(shipments, reminders, notify, new Date()))
      } else {
        await disablePush()
        setPushSt(await pushState())
      }
    } catch (e) {
      setPushSt(await pushState())
      setPushMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setPushBusy(false)
    }
  }

  // someone who needed push before this install had a subscription (summary on, or reminders
  // waiting): subscribe quietly, but only when the browser already allows notifications
  useEffect(() => {
    if (!loaded) return
    const perm = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
    if (!shouldAutoSubscribe(pushWanted(settings.notify.enabled, countPendingReminders(reminders)), pushSt, perm)) return
    enablePush()
      .then(async () => setPushSt(await pushState()))
      .catch(() => {})
  }, [loaded, pushSt, settings.notify.enabled, reminders])

  useReminderEngine({ ready: loaded, shipments, reminders, notify: settings.notify, push, markFired })

  // columns with no data anywhere (not mapped, or empty in every row) are hidden
  const available = useMemo(() => availableFields(shipments), [shipments])
  const groupBy = effectiveGroupBy(settings.groupBy, available)
  const groupChoices = groupOptions(available)
  const range = useMemo(() => {
    if (!shipments.length) return null
    let min = shipments[0].date
    let max = min
    for (const s of shipments) {
      if (s.date < min) min = s.date
      if (s.date > max) max = s.date
    }
    return { min, max }
  }, [shipments])

  const { display } = settings
  // a tone is only meaningful when the data can produce it (e.g. no driver/truck column -> no "assigned")
  const hasAssign = available.driver || available.truck
  const toneVisible = useMemo(
    () => ({
      assigned: display.statusColors && display.tones.assigned.show && hasAssign,
      pending: display.statusColors && display.tones.pending.show && available.status,
      unassigned: display.statusColors && display.tones.unassigned.show && hasAssign,
    }),
    [display, hasAssign, available.status],
  )
  const toneStyle = {
    '--assigned': display.tones.assigned.color,
    '--pending': display.tones.pending.color,
    '--unassigned': display.tones.unassigned.color,
  } as React.CSSProperties
  const legend = (
    [
      { tone: 'assigned', label: 'จัดรถแล้ว' },
      { tone: 'pending', label: 'ขึ้นค้าง' },
      { tone: 'unassigned', label: 'ยังไม่จัดรถ' },
    ] as { tone: Tone; label: string }[]
  ).filter((l) => toneVisible[l.tone])

  const visible = useMemo(() => applyFilters(shipments, filters), [shipments, filters])
  const digest = useMemo(
    () => (loaded ? dailyDigest(shipments, new Date(), settings.notify) : null),
    [loaded, shipments, settings.notify],
  )
  const dueCount = dueReminders(reminders, new Date()).length

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveSettings(next)
    if (patch.theme) applyTheme(patch.theme)
  }
  // what the user actually sees, so the quick toggle flips to the opposite of it
  const osDark = useMedia('(prefers-color-scheme: dark)')
  const isDark = settings.theme === 'dark' || (settings.theme === 'system' && osDark)
  const updateNotify = (notify: NotifySettings) => update({ notify })

  async function afterImport(items: Shipment[], kept: number, removed: number) {
    setShipments(await db.shipments.toArray())
    setFocusDate(nearestDate(items))
    setSelection(null)
    setDialog(null)
    const notes = [kept > 0 && `ข้าม ${kept} รายการที่คุณแก้ไขไว้ในแอป (ไม่ถูกทับ)`, removed > 0 && `ข้าม ${removed} รายการที่คุณลบไว้ (ไม่ถูกนำกลับมา)`].filter(Boolean)
    if (notes.length) push({ title: 'นำเข้าเสร็จ', body: notes.join('\n') })
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

  // On a phone the sheet gets a history entry, so the Back button / swipe-back closes it instead of leaving the app
  const sheetOpen = stacked && !!selection
  useEffect(() => {
    if (!sheetOpen) return
    history.pushState({ sheet: 1 }, '')
    const onPop = () => setSelection(null)
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (history.state?.sheet) history.back() // closed by other means: drop our entry
    }
  }, [sheetOpen])
  const closeSheet = () => setSelection(null)

  async function removeRows(rows: Shipment[]) {
    const ids = new Set(rows.map((r) => r.id))
    await deleteShipments([...ids])
    setShipments((all) => all.filter((s) => !ids.has(s.id)))
    // close the panel when its day has nothing left
    if (selection && !shipments.some((s) => s.date === selection.date && !ids.has(s.id))) setSelection(null)
    push({ title: 'ลบแล้ว', body: `ลบ ${ids.size} รายการ` })
  }

  async function restore(data: { shipments: Shipment[]; reminders: Reminder[] }, mode: 'merge' | 'replace') {
    await restoreBackup(data, mode)
    const [all, rem] = await Promise.all([db.shipments.toArray(), db.reminders.toArray()])
    setShipments(all)
    setReminders(rem)
    setFocusDate(nearestDate(all))
    setSelection(null)
  }

  async function loadSample() {
    const rows = makeSample()
    await db.shipments.bulkPut(rows)
    setShipments(rows)
    setFocusDate(nearestDate(rows))
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

  // Adding a reminder is a click, so this is where Push can be switched on for it: start the
  // permission request before awaiting anything else (iOS only shows the prompt for a gesture).
  const addReminder = async (r: Reminder) => {
    const wantsSubscribe = pushAction(pushSt, true) === 'subscribe'
    const subscribing = wantsSubscribe ? enablePush().then(() => null, (e: unknown) => e) : null
    await db.reminders.put(r)
    const all = await db.reminders.toArray()
    setReminders(all)
    if (!subscribing) return
    setPushBusy(true)
    setPushMsg('')
    const failure = await subscribing
    setPushSt(await pushState())
    if (failure) setPushMsg(failure instanceof Error ? failure.message : String(failure))
    else await doPushSync(buildPushPlan(shipments, all, settings.notify, new Date()))
    setPushBusy(false)
  }

  /** After a reminder is finished or deleted: let go of push if nothing needs it any more. */
  async function releasePushIfIdle(all: Reminder[]) {
    if (pushAction(pushSt, pushWanted(settings.notify.enabled, countPendingReminders(all))) !== 'unsubscribe') return
    try {
      await disablePush()
      setPushSt(await pushState())
    } catch {
      /* the server prunes dead devices itself; nothing to tell the user */
    }
  }
  const toggleReminder = async (r: Reminder) => {
    await db.reminders.update(r.id, { done: !r.done })
    const all = await db.reminders.toArray()
    setReminders(all)
    await releasePushIfIdle(all)
  }
  const deleteReminder = async (id: string) => {
    await db.reminders.delete(id)
    const all = await db.reminders.toArray()
    setReminders(all)
    await releasePushIfIdle(all)
  }
  /** remove every reminder that has already fired */
  const clearFired = async () => {
    const ids = (await db.reminders.toArray()).filter((r) => r.firedAt).map((r) => r.id)
    if (!ids.length) return
    await db.reminders.bulkDelete(ids)
    const all = await db.reminders.toArray()
    setReminders(all)
    await releasePushIfIdle(all)
  }

  async function testNotify() {
    const d = dailyDigest(shipments, new Date(), settings.notify)
    const m = d ?? { title: 'ทดสอบการแจ้งเตือน', body: 'ไม่มีงานวันนี้/พรุ่งนี้ นี่คือข้อความทดสอบ' }
    void systemNotify(m)
    push(m)
    if (settings.notify.sound) void playChime()
    // with push on, also schedule one through the server (~75 s): lock the phone and watch for it
    if (pushSt === 'on') {
      try {
        await testPush(planRef.current)
        setPushMsg('ส่งคำสั่งทดสอบ Push แล้ว ล็อกจอแล้วรอประมาณ 2 นาที จะมีแจ้งเตือน “ทดสอบ Push”')
      } catch (e) {
        setPushMsg(`ทดสอบ Push ไม่สำเร็จ: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  function remindFor(rows: Shipment[], date: string) {
    const so = [...new Set(rows.map((r) => r.so).filter(Boolean))]
    const who = rows[0]?.customerName
    const title = so.length === 1 ? `${so[0]}${who ? ' · ' + who : ''}` : `${rows.length} รายการ${who ? ' · ' + who : ''}`
    setDraft({ title, date })
    setDialog('reminders')
  }

  function resizePanel(patch: Partial<PanelSize>) {
    setPanelSize((s) => {
      const next = { ...s, ...patch }
      savePanelSize(next)
      return next
    })
  }

  const pickGroup = (g: Group) => setSelection({ date: g.date, key: g.key })

  return (
    <div className="app" style={toneStyle}>
      <header className="topbar">
        <h1>Transport Calendar</h1>
        <span className="version" title={`build ${__BUILD_DATE__}`}>
          v{__APP_VERSION__}
        </span>
        <span className="muted">{shipments.length.toLocaleString()} รายการ</span>
        <div className="spacer" />
        <button className="primary" onClick={() => setDialog('import')}>
          นำเข้า Excel
        </button>
        <button onClick={() => setDialog('data')}>ส่งออก / สำรอง</button>
        <button
          onClick={() => update({ theme: isDark ? 'light' : 'dark' })}
          aria-label={isDark ? 'สลับเป็นโหมดสว่าง' : 'สลับเป็นโหมดมืด'}
          title={`ธีม: ${THEME_LABEL[settings.theme]} (กดเพื่อสลับเป็นโหมด${isDark ? 'สว่าง' : 'มืด'})`}
        >
          {isDark ? '☀️' : '🌙'}
        </button>
        <button onClick={() => setDialog('settings')} aria-label="ตั้งค่าการแสดงผล" title="ตั้งค่าการแสดงผล">
          ⚙
        </button>
        <button onClick={() => setDialog('notify')}>🔔 การแจ้งเตือน</button>
        <button onClick={() => { setDraft(null); setDialog('reminders') }}>
          ⏰ เตือนรายการ{dueCount > 0 && <span className="badge">{dueCount}</span>}
        </button>
      </header>

      {shipments.length > 0 && <FilterBar shipments={shipments} available={available} filters={filters} shown={visible.length} onChange={setFilters} />}

      {digest && !bannerOff && (
        <div className="banner" role="status">
          <span className="banner-days">
            📅
            {digest.days.map((d) => (
              <button key={d.date} onClick={() => { setFocusDate(d.date); setSelection({ date: d.date, key: null }) }}>
                {d.label} <b>{d.total}</b>
                {d.unassigned > 0 && <span className="muted"> · ยังไม่จัดรถ {d.unassigned}</span>}
              </button>
            ))}
          </span>
          <button className="icon" onClick={() => setBannerOff(true)} aria-label="ปิด">
            ✕
          </button>
        </div>
      )}

      <main
        ref={mainRef}
        className={selection ? (stacked ? 'sheet-open' : 'with-panel') : ''}
        style={
          {
            // capped so a saved size never swallows a smaller window
            // same ceilings ResizeHandle enforces while dragging (see MAX_VH / EDGE in that file)
            '--panel-w': panelSize.w ? `min(${panelSize.w}px, 100vw - ${EDGE_W}px)` : undefined,
            '--panel-h': panelSize.h ? `min(${panelSize.h}px, ${MAX_VH * 100}vh)` : undefined,
          } as React.CSSProperties
        }
      >
        <section className="cal">
          {loaded && shipments.length === 0 && (
            <div className="empty">
              <b>ยังไม่มีข้อมูล</b>
              <span>นำเข้าไฟล์ Excel (.xlsx) หรือ CSV หัวคอลัมน์จะถูกจับคู่ให้อัตโนมัติ และแก้ได้ก่อนยืนยัน</span>
              <span className="row center">
                <button className="primary" onClick={() => setDialog('import')}>
                  นำเข้า Excel
                </button>
                <button onClick={loadSample}>ลองด้วยข้อมูลตัวอย่าง</button>
              </span>
              <span className="muted small">ข้อมูลถูกเก็บในเบราว์เซอร์นี้เท่านั้น ไม่ส่งไปที่ใด</span>
            </div>
          )}
          <CalendarView
            shipments={visible}
            era={settings.era}
            groupBy={groupBy}
            toneVisible={toneVisible}
            focusDate={focusDate}
            compact={stacked}
            onSelectGroup={pickGroup}
            onSelectDate={(date) => setSelection({ date, key: null })}
          />
          <div className="legend">
            {legend.map((l) => (
              <span key={l.tone}>
                <i className={`dot tone-${l.tone}`} /> {l.label}
              </span>
            ))}
            <span className="spacer" />
            {range && (
              <span className="hide-narrow">
                ข้อมูล {fmtDate(range.min, settings.era, 'D MMM YYYY')} – {fmtDate(range.max, settings.era, 'D MMM YYYY')}
              </span>
            )}
            {shipments.length > 0 && (
              <label className="legend-group">
                จัดกลุ่ม
                <select value={groupBy} onChange={(e) => update({ groupBy: e.target.value as Settings['groupBy'] })}>
                  {groupChoices.map((g) => (
                    <option key={g} value={g}>
                      {GROUP_LABEL[g]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </section>
        {selection && !stacked && (
          <ResizeHandle
            container={mainRef}
            stacked={false}
            onResize={(px) => resizePanel({ w: px })}
            onReset={() => resizePanel({ w: null })}
          />
        )}
        {selection && !stacked && (
          <DetailPanel
            key={`${selection.date}|${selection.key}`}
            date={selection.date}
            groupKeyFilter={selection.key}
            shipments={visible}
            era={settings.era}
            groupBy={groupBy}
            available={available}
            onShowWholeDay={() => setSelection({ date: selection.date, key: null })}
            onEdit={setEditing}
            onDelete={removeRows}
            onRemind={remindFor}
            onClose={() => setSelection(null)}
          />
        )}
        {selection && stacked && (
          <BottomSheet openKey={`${selection.date}|${selection.key}`} onClose={closeSheet}>
            {(expanded) => (
              <DetailPanel
                key={`${selection.date}|${selection.key}`}
                compact
                expanded={expanded}
                date={selection.date}
                groupKeyFilter={selection.key}
                shipments={visible}
                era={settings.era}
                groupBy={groupBy}
                available={available}
                onShowWholeDay={() => setSelection({ date: selection.date, key: null })}
                onEdit={setEditing}
                onDelete={removeRows}
                onRemind={remindFor}
                onClose={closeSheet}
              />
            )}
          </BottomSheet>
        )}
      </main>

      <Toasts />

      <Suspense fallback={null}>
        {dialog === 'import' && <ImportWizard onClose={() => setDialog(null)} onImported={afterImport} />}
        {dialog === 'data' && (
          <DataModal
            all={shipments}
            filtered={visible}
            reminders={reminders}
            groupBy={groupBy}
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
            onAdd={addReminder}
            onToggle={toggleReminder}
            onDelete={deleteReminder}
            onClearFired={clearFired}
            push={{ state: pushSt, status: pushMsg, busy: pushBusy }}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog === 'notify' && (
          <NotifyModal
            notify={settings.notify}
            reminders={reminders}
            onNotify={updateNotify}
            onTest={testNotify}
            push={{ state: pushSt, status: pushMsg, busy: pushBusy }}
            onDigestToggle={toggleDigest}
            onClose={() => setDialog(null)}
          />
        )}
        {dialog === 'settings' && <SettingsModal
            display={display}
            era={settings.era}
            theme={settings.theme}
            groupBy={groupBy}
            groupChoices={groupChoices.map((g) => ({ value: g, label: GROUP_LABEL[g] }))}
            onEra={(era) => update({ era })}
            onTheme={(theme) => update({ theme })}
            onGroupBy={(g) => update({ groupBy: g })}
            onChange={(d) => update({ display: d })}
            onClose={() => setDialog(null)}
          />}
        {editing && <EditModal rows={editing} all={shipments} era={settings.era} onSave={saveEdit} onClose={() => setEditing(null)} />}
      </Suspense>
    </div>
  )
}
