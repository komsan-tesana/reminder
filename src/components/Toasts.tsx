export type Toast = { id: number; title: string; body: string }

type Props = { toasts: Toast[]; onDismiss: (id: number) => void }

export default function Toasts({ toasts, onDismiss }: Props) {
  if (!toasts.length) return null
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <div>
            <b>{t.title}</b>
            <div>{t.body}</div>
          </div>
          <button className="icon" onClick={() => onDismiss(t.id)} aria-label="ปิดการแจ้งเตือน">
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
