import { useState, type PointerEvent, type KeyboardEvent, type RefObject } from 'react'

/** px sizes of the detail panel; null = use the default layout */
export type PanelSize = { w: number | null; h: number | null }

const MIN_PANEL = 300 // narrowest / shortest the panel may get
const MIN_REST = 260 // room always left for the calendar
const PAD = 12 // padding of <main>
const HANDLE = 12
const STEP = 24
/** viewport width kept for padding, handle and the calendar's minimum when the panel is widest */
export const EDGE_W = 2 * PAD + HANDLE + MIN_REST
/**
 * Tallest the panel may be when stacked, as a fraction of the viewport height. Stacked mode scrolls
 * the page, so the height of <main> itself is no limit.
 */
export const MAX_VH = 0.7

type Props = {
  /** the grid that holds calendar, handle and panel */
  container: RefObject<HTMLElement | null>
  /** true when calendar and panel are stacked (narrow screens): resizes height instead of width */
  stacked: boolean
  onResize: (px: number) => void
  onReset: () => void
}

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi))

/** Draggable splitter between the calendar and the detail panel. */
export default function ResizeHandle({ container, stacked, onResize, onReset }: Props) {
  const [dragging, setDragging] = useState(false)

  function sizeFrom(clientX: number, clientY: number): number | null {
    const rect = container.current?.getBoundingClientRect()
    if (!rect) return null
    return stacked
      ? clamp(rect.bottom - PAD - clientY - HANDLE / 2, MIN_PANEL * 0.6, window.innerHeight * MAX_VH)
      : clamp(rect.right - PAD - clientX - HANDLE / 2, MIN_PANEL, Math.min(rect.width, window.innerWidth) - EDGE_W)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!dragging) return
    const px = sizeFrom(e.clientX, e.clientY)
    if (px !== null) onResize(Math.round(px))
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setDragging(false)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const panel = e.currentTarget.nextElementSibling as HTMLElement | null
    if (!panel) return
    const current = stacked ? panel.offsetHeight : panel.offsetWidth
    // the panel is on the right/bottom, so "left/up" makes it bigger
    const grow = stacked ? 'ArrowUp' : 'ArrowLeft'
    const shrink = stacked ? 'ArrowDown' : 'ArrowRight'
    if (e.key === grow || e.key === shrink) {
      e.preventDefault()
      const rect = container.current?.getBoundingClientRect()
      const max = !rect ? current + STEP : stacked ? window.innerHeight * MAX_VH : Math.min(rect.width, window.innerWidth) - EDGE_W
      onResize(clamp(current + (e.key === grow ? STEP : -STEP), stacked ? MIN_PANEL * 0.6 : MIN_PANEL, max))
    } else if (e.key === 'Home' || e.key === 'Enter') {
      e.preventDefault()
      onReset()
    }
  }

  return (
    <div
      className={`resizer ${stacked ? 'stacked' : ''} ${dragging ? 'dragging' : ''}`}
      role="separator"
      aria-orientation={stacked ? 'horizontal' : 'vertical'}
      aria-label="ปรับขนาดแผงรายละเอียด (ดับเบิลคลิกเพื่อรีเซ็ต)"
      title="ลากเพื่อปรับขนาด · ดับเบิลคลิกเพื่อรีเซ็ต"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
    />
  )
}
