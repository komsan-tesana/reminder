import Modal from './Modal'
import Checkbox from './Checkbox'
import PixelCat from './PixelCat'
import { DAILY_POKE_CAP, ITEMS, isShown, isUnlocked, petsLeftToday, type BuddyStats, type Item } from '../lib/buddyUnlocks'
import type { BuddySettings } from '../lib/db'
import type { Outfit, Pose, Skin, Toy } from '../lib/buddySprite'

type Props = {
  stats: BuddyStats
  buddy: BuddySettings
  onBuddy: (b: BuddySettings) => void
  /** what is actually worn right now (after unlock checks) */
  skin: Skin
  outfit: Outfit
  toy: Toy
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

const MOVE_POSE: Record<string, Pose> = { stretch: 'stretch', roll: 'roll', tail: 'tailA', groom: 'groomA', zoom: 'zoomA', stand: 'stand' }
const GROUPS: { kind: Item['kind']; title: string; note: string }[] = [
  { kind: 'skin', title: 'สีขน', note: 'เลือกได้ทีละแบบ' },
  { kind: 'outfit', title: 'ชุด', note: 'กดซ้ำเพื่อถอด' },
  { kind: 'toy', title: 'ของเล่นในปาก', note: 'ปลดล็อกจากข้อมูลของคุณเอง · กดซ้ำเพื่อวางลง' },
  { kind: 'move', title: 'ท่าทาง', note: 'ปลดล็อกแล้วเปี๊ยกจะทำเองตามอารมณ์' },
]

/** The wardrobe: everything the cat can unlock, what is still locked and how far along you are. */
export default function BuddyModal({ stats, buddy, onBuddy, skin, outfit, toy, onEquip, onClose }: Props) {
  const now = new Date()
  const total = ITEMS.length
  const got = ITEMS.filter((i) => isUnlocked(i, stats, now)).length

  return (
    <Modal title="เปี๊ยก แมวประจำแอป" onClose={onClose} wide footer={<button className="primary" onClick={onClose}>เสร็จ</button>}>
      <div className="flex items-center gap-4 rounded-lg border border-line bg-bg p-3">
        <div className="shrink-0">
          <PixelCat pose="sit" skin={skin} outfit={outfit} toy={toy} scale={5} />
        </div>
        <div className="min-w-0">
          <b>เปี๊ยก</b>
          <p className="muted m-0 small">
            ปลดล็อกแล้ว {got}/{total} · ทักแล้ว {stats.pets.toLocaleString('en-US')} ครั้ง (วันนี้นับได้อีก {petsLeftToday(stats, now)}/{DAILY_POKE_CAP}) · เปิดแอปมา {stats.totalDays} วัน (ติดกันสูงสุด {stats.bestStreak}) · เตือนเสร็จ {stats.remindersDone} · นำเข้า {stats.imports} ครั้ง
          </p>
        </div>
      </div>

      <h3>ตั้งค่า</h3>
      <div className="form">
        <label className="row">
          <Checkbox checked={buddy.visible} onChange={(visible) => onBuddy({ ...buddy, visible })} />
          แสดงเปี๊ยก (เดินเล่นที่ขอบล่างของจอ กดเพื่อทักทาย)
        </label>
        <label className="row">
          <Checkbox disabled={!buddy.visible} checked={buddy.sound} onChange={(sound) => onBuddy({ ...buddy, sound })} />
          🔊 เสียงเมี๊ยวตอนกดทัก (ปิดไว้ก่อนเป็นค่าเริ่มต้น)
        </label>
        <p className="muted small">เปี๊ยกพูดถึงงานของวันนี้ตามข้อมูลในเครื่องนี้เท่านั้น ไม่มีอะไรถูกส่งออกไป</p>
      </div>

      {GROUPS.map((g) => (
        <section key={g.kind}>
          <h3>
            {g.title} <span className="muted small font-normal">· {g.note}</span>
          </h3>
          <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
            {ITEMS.filter((i) => i.kind === g.kind).map((item) => {
              const p = item.progress(stats, now)
              const open = isUnlocked(item, stats, now) // earned items stay open even if the progress reads lower
              const drawn = isShown(item) // a toy can be unlocked before its picture exists
              const worn = item.kind === 'skin' ? skin === item.id : item.kind === 'outfit' ? outfit === item.id : item.kind === 'toy' ? toy === item.id : false
              const equip = () => {
                if (!open || !drawn) return
                if (item.kind === 'skin') onEquip({ skin: item.id })
                if (item.kind === 'outfit') onEquip({ outfit: worn && item.id !== 'none' ? 'none' : item.id })
                if (item.kind === 'toy') onEquip({ toy: worn && item.id !== 'notoy' ? 'notoy' : item.id })
              }
              const pose: Pose = item.kind === 'move' ? MOVE_POSE[item.id] : 'sit'
              return (
                <li key={item.id}>
                  <Tile
                    isButton={item.kind !== 'move'}
                    className={`flex h-full w-full flex-col items-center gap-1 rounded-md border bg-card !p-2 text-center font-normal ${worn ? '!border-accent' : 'border-line'}`}
                    onClick={equip}
                    pressed={item.kind === 'move' ? undefined : worn}
                    label={`${item.name}${open ? (drawn ? '' : ' (กำลังวาดภาพ)') : ' (ยังล็อกอยู่)'}`}
                  >
                    <span className={open ? '' : 'opacity-35 grayscale'}>
                      <PixelCat pose={pose} skin={item.kind === 'skin' ? (item.id as Skin) : skin} outfit={item.kind === 'outfit' ? (item.id as Outfit) : item.kind === 'move' ? outfit : 'none'} toy={item.kind === 'toy' && drawn ? (item.id as Toy) : 'notoy'} scale={2} />
                    </span>
                    <b className="text-[13px]">
                      {open ? '' : '🔒 '}
                      {item.name}
                    </b>
                    {open ? (
                      <span className="muted small">{!drawn ? 'ปลดล็อกแล้ว · กำลังวาดภาพ ยังใส่ไม่ได้' : worn ? '✓ ใส่อยู่' : item.kind === 'move' ? 'ปลดล็อกแล้ว' : 'กดเพื่อใส่'}</span>
                    ) : (
                      <span className="flex w-full flex-col items-center gap-1">
                        <span className="muted small">{item.hint}</span>
                        {p.total > 1 && (
                          <>
                            <span className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done} aria-label={`ความคืบหน้า ${item.name}`}>
                              <span className="block h-full rounded-full bg-accent-fill" style={{ width: `${(p.done / p.total) * 100}%` }} />
                            </span>
                            <span className="muted text-[11px]">
                              {p.done.toLocaleString('en-US')}/{p.total.toLocaleString('en-US')}
                            </span>
                          </>
                        )}
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
