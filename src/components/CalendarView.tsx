import { useEffect, useMemo, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import thLocale from '@fullcalendar/core/locales/th'
import dayjs from 'dayjs'
import { buildGroups, type Group, type Tone } from '../lib/group'
import { fmtDate, shortName } from '../lib/format'
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
      (compact ? [] : groups).map((g) => ({
        id: g.id,
        title: `${groupBy === 'customer' ? shortName(g.label) : g.label} (${g.rows.length})`,
        extendedProps: { full: `${g.label} · ${g.rows.length} รายการ` },
        start: g.date,
        allDay: true,
        classNames: [`tone-${toneVisible[g.tone] ? g.tone : 'none'}`],
      })),
    [groups, toneVisible, groupBy, compact],
  )

  useEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(() => ref.current?.getApi().updateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (focusDate) ref.current?.getApi().gotoDate(focusDate)
  }, [focusDate])

  // FullCalendar's built-in Thai locale would force Buddhist years; format titles ourselves
  // so the era follows the user's setting.
  const title = ({ date }: TitleArg) => fmtDate(dayjs(new Date(date.year, date.month, date.day)).format('YYYY-MM-DD'), era, 'MMMM YYYY')

  return (
    <div className={compact ? 'fc-host compact' : 'fc-host'} ref={host}>
    <FullCalendar
      ref={ref}
      plugins={[dayGridPlugin, listPlugin, interactionPlugin]}
      locales={[thLocale]}
      locale="th"
      initialView="dayGridMonth"
      headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek,listMonth' }}
      titleFormat={title as never}
      events={events}
      dayMaxEvents={4}
      dayCellContent={
        compact
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
