export type Toast = { id: number; title: string; body: string }

type Props = { toasts: Toast[]; onDismiss: (id: number) => void }

export default function Toasts({ toasts, onDismiss }: Props) {
  if (!toasts.length) return null
  return (
    <div className="fixed right-4 bottom-4 z-[60] flex max-w-[min(360px,calc(100vw-32px))] flex-col gap-2 max-[820px]:left-4" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-start justify-between gap-2 rounded-lg border border-l-4 border-line border-l-accent bg-card px-3 py-2.5 text-ink shadow-xl">
          <div>
            <b>{t.title}</b>
            <div className="whitespace-pre-line">{t.body}</div>
          </div>
          <button className="icon" onClick={() => onDismiss(t.id)} aria-label="ปิดการแจ้งเตือน">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
