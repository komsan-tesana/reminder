import { useState, type ReactNode } from 'react'
import { Drawer } from 'vaul'

/** Snap points as fractions of the viewport height: peek (summary), half, full. */
const SNAPS = [0.32, 0.65, 1]

type Props = {
  /** changes when a different day/group is opened, so the sheet starts at the peek again */
  openKey: string
  onClose: () => void
  children: (expanded: boolean) => ReactNode
}

/**
 * Phone replacement for the side panel: a non-modal bottom sheet (the calendar above stays tappable).
 * Drag it between peek / half / full, swipe down to dismiss.
 */
export default function BottomSheet({ openKey, onClose, children }: Props) {
  const [snap, setSnap] = useState<number | string | null>(SNAPS[0])
  const [seen, setSeen] = useState(openKey)
  if (seen !== openKey) {
    setSeen(openKey)
    setSnap(SNAPS[0])
  }
  const expanded = snap === SNAPS[SNAPS.length - 1]
  return (
    <Drawer.Root open modal={false} snapPoints={SNAPS} activeSnapPoint={snap} setActiveSnapPoint={setSnap} onOpenChange={(o) => !o && onClose()}>
      <Drawer.Portal>
        <Drawer.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-40 mx-[-1px] flex h-full max-h-[97%] flex-col rounded-t-2xl border border-b-0 border-line bg-card text-ink shadow-[0_-8px_24px_rgb(0_0_0/0.25)] outline-none"
        >
          <Drawer.Title className="sr-only">รายละเอียดรายการ</Drawer.Title>
          <div className="mx-auto my-2 h-1.5 w-12 shrink-0 rounded-full bg-line" aria-hidden />
          {children(expanded)}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
