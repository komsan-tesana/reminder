import * as Popover from '@radix-ui/react-popover'
import { useEffect, useRef, useState } from 'react'
import { DayPicker } from 'react-day-picker'
import { th } from 'react-day-picker/locale'
import 'react-day-picker/style.css'
import { fmtDate } from '../lib/format'
import { localDate, localDateTime, localTime } from '../lib/reminders'
import type { Era } from '../types'

const pad = (n: number) => String(n).padStart(2, '0')
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i))
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i))

function Column({ items, value, onPick, label }: { items: string[]; value: string; onPick: (v: string) => void; label: string }) {
  const sel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    sel.current?.scrollIntoView({ block: 'center' })
  }, [])
  return (
    <div className="flex max-h-28 w-14 flex-col gap-0.5 overflow-y-auto" role="listbox" aria-label={label}>
      {items.map((v) => (
        <button
          key={v}
          ref={v === value ? sel : undefined}
          role="option"
          aria-selected={v === value}
          className={`!border-0 !px-0 !py-1 text-center ${v === value ? '!bg-accent-fill !text-white font-semibold' : '!bg-transparent'}`}
          onClick={() => onPick(v)}
        >
          {v}
        </button>
      ))}
    </div>
  )
}

function TimeColumns({ time, onChange }: { time: string; onChange: (t: string) => void }) {
  const [h, m] = (time || '00:00').split(':')
  return (
    <div className="flex items-start gap-1">
      <Column items={HOURS} value={h} onPick={(v) => onChange(`${v}:${m}`)} label="ชั่วโมง" />
      <Column items={MINUTES} value={m} onPick={(v) => onChange(`${h}:${v}`)} label="นาที" />
    </div>
  )
}

const content =
  'z-[70] w-max rounded-lg border border-line bg-card p-3 text-ink shadow-xl outline-none max-w-[calc(100vw-16px)] max-h-[var(--radix-popover-content-available-height)] overflow-auto'

/** Time of day ("HH:mm") from a popup of hour / minute columns. */
export function TimePicker({ value, onChange, label }: { value: string; onChange: (t: string) => void; label: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger aria-label={label} className="min-w-20 text-center">
        🕒 {value || '--:--'}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} collisionPadding={8} className={content}>
          <TimeColumns time={value} onChange={onChange} />
          <button className="mt-2 w-full" onClick={() => onChange(localTime(new Date()))}>
            ตอนนี้
          </button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

type DTProps = { value: string; onChange: (v: string) => void; era: Era; label: string }

/** Date and time ("yyyy-mm-ddTHH:mm", local) from a calendar plus hour / minute columns. */
export function DateTimePicker({ value, onChange, era, label }: DTProps) {
  const [open, setOpen] = useState(false)
  const date = value.slice(0, 10)
  const time = value.slice(11, 16) || '08:00'
  const selected = date ? new Date(`${date}T00:00:00`) : undefined
  const [month, setMonth] = useState<Date>(selected ?? new Date())
  const join = (d: string, t: string) => `${d}T${t}`
  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) return
        // nothing chosen yet: start from the current date and time
        if (!value) onChange(localDateTime(new Date()))
        setMonth(selected ?? new Date())
      }}
    >
      <Popover.Trigger aria-label={label} className="min-w-44 text-left">
        📅 {date ? `${fmtDate(date, era, 'D MMM YYYY')} · ${time}` : 'เลือกวันและเวลา'}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} collisionPadding={8} className={content}>
          <div>
            <DayPicker
              mode="single"
              locale={th}
              weekStartsOn={1}
              showOutsideDays
              month={month}
              onMonthChange={setMonth}
              selected={selected}
              onSelect={(d) => d && onChange(join(localDate(d), time))}
              formatters={{ formatCaption: (m) => fmtDate(localDate(m), era, 'MMMM YYYY') }}
              style={
                {
                  '--rdp-accent-color': 'var(--accent-fill)',
                  '--rdp-accent-background-color': 'color-mix(in srgb, var(--accent) 18%, transparent)',
                  '--rdp-day-height': '34px',
                  '--rdp-day-width': '34px',
                  '--rdp-day_button-height': '32px',
                  '--rdp-day_button-width': '32px',
                } as React.CSSProperties
              }
            />
          </div>
          <div className="mt-2 flex items-end justify-between gap-3 border-t border-line pt-2">
            <TimeColumns time={time} onChange={(t) => onChange(join(date || localDate(new Date()), t))} />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onChange(localDateTime(new Date()))
                  setMonth(new Date())
                }}
              >
                ตอนนี้
              </button>
              <button className="primary" onClick={() => setOpen(false)}>
                ตกลง
              </button>
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

type DProps = { value: string; onChange: (v: string) => void; era: Era; label: string; placeholder?: string }

/** Date only ("yyyy-mm-dd") from a calendar popup; shows `placeholder` while empty. */
export function DatePicker({ value, onChange, era, label, placeholder = 'เลือกวันที่' }: DProps) {
  const [open, setOpen] = useState(false)
  const selected = value ? new Date(`${value}T00:00:00`) : undefined
  const valid = !!selected && !Number.isNaN(selected.getTime())
  const [month, setMonth] = useState<Date>(valid ? selected! : new Date())
  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setMonth(valid ? selected! : new Date())
      }}
    >
      <Popover.Trigger aria-label={label} className="min-w-44 text-left">
        📅 {valid ? fmtDate(value, era, 'D MMM YYYY') : <span className="text-muted">{placeholder}</span>}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} collisionPadding={8} className={content}>
          <DayPicker
            mode="single"
            locale={th}
            weekStartsOn={1}
            showOutsideDays
            month={month}
            onMonthChange={setMonth}
            selected={valid ? selected : undefined}
            onSelect={(d) => {
              if (!d) return
              onChange(localDate(d))
              setOpen(false)
            }}
            formatters={{ formatCaption: (m) => fmtDate(localDate(m), era, 'MMMM YYYY') }}
            style={
              {
                '--rdp-accent-color': 'var(--accent-fill)',
                '--rdp-accent-background-color': 'color-mix(in srgb, var(--accent) 18%, transparent)',
                '--rdp-day-height': '34px',
                '--rdp-day-width': '34px',
                '--rdp-day_button-height': '32px',
                '--rdp-day_button-width': '32px',
              } as React.CSSProperties
            }
          />
          <div className="mt-2 flex justify-end border-t border-line pt-2">
            <button
              onClick={() => {
                onChange(localDate(new Date()))
                setOpen(false)
              }}
            >
              วันนี้
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
