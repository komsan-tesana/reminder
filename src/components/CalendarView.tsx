import { useEffect, useMemo, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import listPlugin from '@fullcalendar/list'
import interactionPlugin from '@fullcalendar/interaction'
import thLocale from '@fullcalendar/core/locales/th'
import dayjs from 'dayjs'
import { buildGroups, type Group } from '../lib/group'
import { fmtDate } from '../lib/format'
import type { Era, GroupBy, Shipment } from '../types'

type Props = {
  shipments: Shipment[]
  era: Era
  groupBy: GroupBy
  focusDate: string | null
  onSelectGroup: (g: Group) => void
  onSelectDate: (date: string) => void
}

type TitleArg = { date: { year: number; month: number; day: number } }

export default function CalendarView({ shipments, era, groupBy, focusDate, onSelectGroup, onSelectDate }: Props) {
  const ref = useRef<FullCalendar>(null)
  const groups = useMemo(() => buildGroups(shipments, groupBy), [shipments, groupBy])
  const byId = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  const events = useMemo(
    () =>
      groups.map((g) => ({
        id: g.id,
        title: `${g.label} (${g.rows.length})`,
        start: g.date,
        allDay: true,
        classNames: [`tone-${g.tone}`],
      })),
    [groups],
  )

  useEffect(() => {
    if (focusDate) ref.current?.getApi().gotoDate(focusDate)
  }, [focusDate])

  // FullCalendar's built-in Thai locale would force Buddhist years; format titles ourselves
  // so the era follows the user's setting.
  const title = ({ date }: TitleArg) => fmtDate(dayjs(new Date(date.year, date.month, date.day)).format('YYYY-MM-DD'), era, 'MMMM YYYY')

  return (
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
      height="100%"
      eventClick={(info) => {
        const g = byId.get(info.event.id)
        if (g) onSelectGroup(g)
      }}
      dateClick={(info) => onSelectDate(info.dateStr)}
    />
  )
}
