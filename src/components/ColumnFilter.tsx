import * as Popover from '@radix-ui/react-popover'
import { useMemo, useState } from 'react'
import Checkbox from './Checkbox'

type Props = {
  label: string
  /** every distinct value in the column (empty string = blank cells) */
  values: string[]
  /** allowed values; undefined = no filter */
  selected: string[] | undefined
  onChange: (next: string[] | undefined) => void
}

const BLANK = '(ว่าง)'

/** Excel-style header filter: a searchable checklist of the column's values. */
export default function ColumnFilter({ label, values, selected, onChange }: Props) {
  const [q, setQ] = useState('')
  const distinct = useMemo(() => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'th')), [values])
  const shown = distinct.filter((v) => (v || BLANK).toLowerCase().includes(q.trim().toLowerCase()))
  const on = selected !== undefined
  const has = (v: string) => !on || selected.includes(v)

  function toggle(v: string) {
    const cur = on ? selected : distinct
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]
    // everything ticked again = no filter at all
    onChange(next.length === distinct.length ? undefined : next)
  }

  return (
    <Popover.Root onOpenChange={(o) => !o && setQ('')}>
      <Popover.Trigger
        aria-label={`กรอง ${label}`}
        title={on ? `กรองอยู่ (${selected.length}/${distinct.length})` : `กรอง ${label}`}
        className={`icon !px-1 !py-0 align-middle text-xs ${on ? '!text-accent font-bold' : 'text-muted'}`}
      >
        {on ? '▼' : '▾'}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={4} collisionPadding={8} className="z-50 w-60 max-w-[calc(100vw-16px)] rounded-lg border border-line bg-card p-2 text-ink shadow-xl outline-none">
          <input className="mb-2 w-full" type="search" placeholder={`ค้นหา ${label}…`} aria-label={`ค้นหาค่าใน ${label}`} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="mb-1 flex gap-2 text-xs">
            <button className="icon !p-0 text-accent" onClick={() => onChange(undefined)}>
              เลือกทั้งหมด
            </button>
            <button className="icon !p-0 text-accent" onClick={() => onChange([])}>
              ล้างทั้งหมด
            </button>
            <span className="muted ml-auto">{on ? `${selected.length}/${distinct.length}` : distinct.length}</span>
          </div>
          <ul className="m-0 max-h-56 list-none overflow-y-auto p-0">
            {shown.map((v) => (
              <li key={v}>
                <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 font-normal hover:bg-accent/10">
                  <Checkbox className="mt-0.5" checked={has(v)} onChange={() => toggle(v)} />
                  <span className="min-w-0 break-words whitespace-normal">{v || BLANK}</span>
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="muted px-1 py-1">ไม่พบ</li>}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
