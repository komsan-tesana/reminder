import { useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import thLocale from '@fullcalendar/core/locales/th'
import dayjs from 'dayjs'
import { buildGroups, type Group, type Tone } from '../lib/group'
import { fmtDate, fmtQty, shortName } from '../lib/format'
import type { Era, GroupBy, Shipment } from '../types'

type Props = {
  shipments: Shipment[]
  era: Era
  groupBy: GroupBy
  /** tones whose colour is shown; hidden ones render as a neutral chip */
  toneVisible: Record<Tone, boolean>
  focusDate: string | null
  /** phone layout: no chips, each day shows its row count and the day opens in the bottom sheet */
  compact: boolean
  onSelectGroup: (g: Group) => void
  onSelectDate: (date: string) => void
}

type TitleArg = { date: { year: number; month: number; day: number } }

export default function CalendarView({ shipments, era, groupBy, toneVisible, focusDate, compact, onSelectGroup, onSelectDate }: Props) {
  const ref = useRef<FullCalendar>(null)
  const host = useRef<HTMLDivElement>(null)
  const [viewType, setViewType] = useState('dayGridMonth')
  // phone: the month grid is too narrow for chips, so it shows counts; week and schedule are lists with the details
  const monthCounts = compact && viewType === 'dayGridMonth'
  const groups = useMemo(() => buildGroups(shipments, groupBy), [shipments, groupBy])
  const byId = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  // per-day totals for the compact layout; the badge takes the most urgent tone of the day
  const perDay = useMemo(() => {
    const rank: Record<Tone, number> = { pending: 2, unassigned: 1, assigned: 0 }
    const m = new Map<string, { n: number; tone: Tone }>()
    for (const g of groups) {
      const cur = m.get(g.date)
      m.set(g.date, { n: (cur?.n ?? 0) + g.rows.length, tone: !cur || rank[g.tone] > rank[cur.tone] ? g.tone : cur.tone })
    }
    return m
  }, [groups])
  const events = useMemo(
    () =>
      (monthCounts ? [] : groups).map((g) => ({
        id: g.id,
        title: `${groupBy === 'customer' ? shortName(g.label) : g.label} (${g.rows.length})`,
        extendedProps: { full: `${g.label} · ${g.rows.length} รายการ` },
        start: g.date,
        allDay: true,
        classNames: [`tone-${toneVisible[g.tone] ? g.tone : 'none'}`],
      })),
    [groups, toneVisible, groupBy, monthCounts],
  )

  useEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(() => ref.current?.getApi().updateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // a week grid cannot be read on a phone; go to the week list when the layout turns compact
  useEffect(() => {
    if (compact && ref.current?.getApi().view.type === 'dayGridWeek') ref.current.getApi().changeView('listWeek')
  }, [compact])

  useEffect(() => {
    if (focusDate) ref.current?.getApi().gotoDate(focusDate)
  }, [focusDate])

  // FullCalendar's built-in Thai locale would force Buddhist years; format titles ourselves
  // so the era follows the user's setting.
  const title = ({ date }: TitleArg) => fmtDate(dayjs(new Date(date.year, date.month, date.day)).format('YYYY-MM-DD'), era, 'MMMM YYYY')

  return (
    <div className={monthCounts ? 'fc-host compact' : 'fc-host'} ref={host}>
    <FullCalendar
      ref={ref}
      plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
      locales={[thLocale]}
      locale="th"
      initialView="dayGridMonth"
      headerToolbar={{ left: 'prev,next today', center: 'title', right: compact ? 'dayGridMonth,listWeek,listMonth' : 'dayGridMonth,dayGridWeek,listMonth' }}
      buttonText={{ listWeek: 'สัปดาห์', listMonth: 'กำหนดการ' }}
      datesSet={(arg) => setViewType(arg.view.type)}
      eventContent={
        compact && viewType.startsWith('list')
          ? (arg) => {
              const g = byId.get(arg.event.id)
              if (!g) return undefined
              const shown = g.rows.slice(0, 6)
              return (
                <div className="list-detail">
                  <b>{arg.event.title}</b>
                  {shown.map((r) => (
                    <div key={r.id} className="list-row">
                      {[r.so, r.description, r.qty ? `${fmtQty(r.qty)} ${r.unit ?? ''}`.trim() : '', r.status].filter(Boolean).join(' · ')}
                    </div>
                  ))}
                  {g.rows.length > shown.length && <div className="list-row">… อีก {g.rows.length - shown.length} รายการ</div>}
                </div>
              )
            }
          : undefined
      }
      titleFormat={title as never}
      events={events}
      dayMaxEvents={4}
      dayCellContent={
        monthCounts
          ? (arg) => {
              const d = perDay.get(dayjs(arg.date).format('YYYY-MM-DD'))
              return (
                <>
                  <span>{arg.dayNumberText}</span>
                  {d && <span className={`day-count tone-${toneVisible[d.tone] ? d.tone : 'none'}`}>{d.n}</span>}
                </>
              )
            }
          : undefined
      }
      height="100%"
      eventDidMount={(info) => {
        // full name on hover; the chip itself is truncated in narrow cells
        info.el.title = String(info.event.extendedProps.full ?? '')
      }}
      eventClick={(info) => {
        const g = byId.get(info.event.id)
        if (g) onSelectGroup(g)
      }}
      dateClick={(info) => onSelectDate(info.dateStr)}
    />
    </div>
  )
}
