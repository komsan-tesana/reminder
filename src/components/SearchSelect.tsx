import { useEffect, useMemo, useRef, useState } from 'react'

export type Option = { value: string; label: string }

type Props = {
  /** short name shown before the value, e.g. "คนขับ" */
  title: string
  value: string
  options: Option[]
  onChange: (value: string) => void
}

/** A select you can type into: the list narrows as you type. */
export default function SearchSelect({ title, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)

  const current = options.find((o) => o.value === value)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options
  }, [options, query])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function close() {
    setOpen(false)
    setQuery('')
  }
  function openList() {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  function pick(o: Option | undefined) {
    if (o) onChange(o.value)
    close()
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) openList()
      else setActive((a) => Math.min(a + 1, shown.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      pick(shown[active])
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation()
      close()
    }
  }

  const display = current ? `${title}: ${current.label}` : title

  return (
    <div className={`ss ${value ? 'on' : ''}`} ref={root}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-label={title}
        value={open ? query : display}
        placeholder={open ? `ค้นหา${title}…` : undefined}
        onFocus={openList}
        onClick={() => !open && openList()}
        onChange={(e) => {
          setQuery(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={onKey}
      />
      <span className="ss-caret" aria-hidden>
        ▾
      </span>
      {open && (
        <ul className="ss-list" role="listbox" ref={list}>
          {shown.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={i === active ? 'active' : ''}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o)
              }}
            >
              {o.label}
            </li>
          ))}
          {shown.length === 0 && <li className="muted">ไม่พบ “{query}”</li>}
        </ul>
      )}
    </div>
  )
}
