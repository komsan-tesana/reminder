import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

type Props = { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }

/** Radix Dialog gives focus trapping, Escape, scroll lock and aria wiring; the look is Tailwind utilities. */
export default function Modal({ title, onClose, children, footer, wide }: Props) {
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content
          aria-describedby={undefined}
          className={`fixed top-1/2 left-1/2 z-50 flex max-h-[92vh] -translate-x-1/2 -translate-y-1/2 flex-col gap-1 overflow-auto rounded-xl bg-card p-4 text-ink shadow-2xl outline-none ${
            wide ? 'w-[min(900px,calc(100vw-32px))]' : 'w-[min(560px,calc(100vw-32px))]'
          }`}
        >
          <header className="flex items-center justify-between">
            <Dialog.Title className="m-0 text-base">{title}</Dialog.Title>
            <Dialog.Close className="icon" aria-label="ปิด">
              ✕
            </Dialog.Close>
          </header>
          {children}
          {footer && <footer className="mt-3 flex justify-end gap-2">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
