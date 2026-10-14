import Modal from './Modal'
import PixelCat from './PixelCat'
import { ITEMS, isUnlocked, type BuddyStats, type Item } from '../lib/buddyUnlocks'
import type { BuddySettings } from '../lib/db'
import type { Outfit, Pose, Skin } from '../lib/buddySprite'

type Props = {
  stats: BuddyStats
  /** what is actually worn right now (after unlock checks) */
  skin: Skin
  outfit: Outfit
  onEquip: (patch: Partial<BuddySettings>) => void
  onClose: () => void
}

/** a button you can equip, or a plain box for moves (they are not equipped, just unlocked) */
function Tile({ isButton, className, onClick, pressed, label, children }: { isButton: boolean; className: string; onClick: () => void; pressed?: boolean; label: string; children: React.ReactNode }) {
  return isButton ? (
    <button className={className} onClick={onClick} aria-pressed={pressed} aria-label={label}>
      {children}
    </button>
  ) : (
    <div className={className} aria-label={label} role="group">
      {children}
    </div>
  )
}

const MOVE_POSE: Record<string, Pose> = { stretch: 'stretch', roll: 'roll', tail: 'tailA' }
const GROUPS: { kind: Item['kind']; title: string; note: string }[] = [
  { kind: 'skin', title: 'สีขน', note: 'เลือกได้ทีละแบบ' },
  { kind: 'outfit', title: 'ชุด', note: 'กดซ้ำเพื่อถอด' },
  { kind: 'move', title: 'ท่าทาง', note: 'ปลดล็อกแล้วเปี๊ยกจะทำเองตามอารมณ์' },
]

/** The wardrobe: everything the cat can unlock, what is still locked and how far along you are. */
export default function BuddyModal({ stats, skin, outfit, onEquip, onClose }: Props) {
  const now = new Date()
  const total = ITEMS.length
  const got = ITEMS.filter((i) => isUnlocked(i, stats, now)).length

  return (
    <Modal title="🐱 ตู้เสื้อผ้าเปี๊ยก" onClose={onClose} wide footer={<button className="primary" onClick={onClose}>เสร็จ</button>}>
      <div className="flex items-center gap-4 rounded-lg border border-line bg-bg p-3">
        <div className="shrink-0">
          <PixelCat pose="sit" skin={skin} outfit={outfit} scale={5} />
        </div>
        <div className="min-w-0">
          <b>เปี๊ยก</b>
          <p className="muted m-0 small">
            ปลดล็อกแล้ว {got}/{total} · ทักแล้ว {stats.pets} ครั้ง · เปิดแอปมา {stats.days.length} วัน · เตือนเสร็จ {stats.remindersDone} · นำเข้า {stats.imports} ครั้ง
          </p>
        </div>
      </div>

      {GROUPS.map((g) => (
        <section key={g.kind}>
          <h3>
            {g.title} <span className="muted small font-normal">· {g.note}</span>
          </h3>
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
            {ITEMS.filter((i) => i.kind === g.kind).map((item) => {
              const p = item.progress(stats, now)
              const open = p.done >= p.total
              const worn = item.kind === 'skin' ? skin === item.id : item.kind === 'outfit' ? outfit === item.id : false
              const equip = () => {
                if (!open) return
                if (item.kind === 'skin') onEquip({ skin: item.id })
                if (item.kind === 'outfit') onEquip({ outfit: worn && item.id !== 'none' ? 'none' : item.id })
              }
              const pose: Pose = item.kind === 'move' ? MOVE_POSE[item.id] : 'sit'
              return (
                <li key={item.id}>
                  <Tile
                    isButton={item.kind !== 'move'}
                    className={`flex h-full w-full flex-col items-center gap-1 rounded-md border bg-card !p-2 text-center font-normal ${worn ? '!border-accent' : 'border-line'}`}
                    onClick={equip}
                    pressed={item.kind === 'move' ? undefined : worn}
                    label={`${item.name}${open ? '' : ' (ยังล็อกอยู่)'}`}
                  >
                    <span className={open ? '' : 'opacity-35 grayscale'}>
                      <PixelCat pose={pose} skin={item.kind === 'skin' ? (item.id as Skin) : skin} outfit={item.kind === 'outfit' ? (item.id as Outfit) : item.kind === 'move' ? outfit : 'none'} scale={2} />
                    </span>
                    <b className="text-[13px]">
                      {open ? '' : '🔒 '}
                      {item.name}
                    </b>
                    {open ? (
                      <span className="muted small">{worn ? '✓ ใส่อยู่' : item.kind === 'move' ? 'ปลดล็อกแล้ว' : 'กดเพื่อใส่'}</span>
                    ) : (
                      <span className="muted small">
                        {item.hint}
                        {p.total > 1 && ` (${p.done}/${p.total})`}
                      </span>
                    )}
                  </Tile>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </Modal>
  )
}
