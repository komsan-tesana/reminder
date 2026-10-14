import Modal from './Modal'
import Select from './Select'
import Checkbox from './Checkbox'
import { DEFAULT_TONES, type BuddySettings, type DisplaySettings } from '../lib/db'
import type { Tone } from '../lib/group'
import { THEMES, THEME_LABEL } from '../lib/theme'
import type { Era, GroupBy, Theme } from '../types'

type Props = {
  display: DisplaySettings
  era: Era
  theme: Theme
  groupBy: GroupBy
  groupChoices: { value: GroupBy; label: string }[]
  onEra: (e: Era) => void
  onTheme: (t: Theme) => void
  onGroupBy: (g: GroupBy) => void
  onChange: (d: DisplaySettings) => void
  buddy: BuddySettings
  onBuddy: (b: BuddySettings) => void
  onWardrobe: () => void
  onClose: () => void
}

const TONES: { tone: Tone; label: string; hint: string }[] = [
  { tone: 'assigned', label: 'จัดรถแล้ว', hint: 'มีคนขับหรือรถแล้ว' },
  { tone: 'pending', label: 'ขึ้นค้าง', hint: 'สถานะมีคำว่า “ค้าง”' },
  { tone: 'unassigned', label: 'ยังไม่จัดรถ', hint: 'ยังไม่มีคนขับ/รถ' },
]

export default function SettingsModal({ display, era, theme, groupBy, groupChoices, onEra, onTheme, onGroupBy, onChange, buddy, onBuddy, onWardrobe, onClose }: Props) {
  const setTone = (tone: Tone, patch: Partial<DisplaySettings['tones'][Tone]>) =>
    onChange({ ...display, tones: { ...display.tones, [tone]: { ...display.tones[tone], ...patch } } })

  return (
    <Modal
      title="ตั้งค่าการแสดงผล"
      onClose={onClose}
      footer={
        <>
          <button onClick={() => onChange({ statusColors: true, tones: DEFAULT_TONES })}>คืนค่าเริ่มต้น</button>
          <button className="primary" onClick={onClose}>
            เสร็จ
          </button>
        </>
      }
    >
      <h3>ธีม</h3>
      <div className="form">
        <div className="seg" role="radiogroup" aria-label="ธีม">
          {THEMES.map((t) => (
            <button key={t} role="radio" aria-checked={theme === t} className={theme === t ? 'on' : ''} onClick={() => onTheme(t)}>
              {t === 'light' ? '☀️ ' : t === 'dark' ? '🌙 ' : '🖥 '}
              {THEME_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <h3>ปฏิทิน</h3>
      <div className="form">
        <div className="row">
          <label>
            จัดกลุ่มชิปตาม
            <Select value={groupBy} label="จัดกลุ่มชิปตาม" options={groupChoices} onChange={(v) => onGroupBy(v as GroupBy)} />
          </label>
          <label>
            ปีที่แสดง
            <Select
              value={era}
              label="ปีที่แสดง"
              options={[
                { value: 'BE', label: 'พ.ศ.' },
                { value: 'CE', label: 'ค.ศ.' },
              ]}
              onChange={(v) => onEra(v as Era)}
            />
          </label>
        </div>
      </div>

      <h3>สีสถานะงานบนปฏิทิน</h3>
      <div className="form">
        <label className="row">
          <Checkbox checked={display.statusColors} onChange={(statusColors) => onChange({ ...display, statusColors })} />
          แสดงสีตามสถานะ (ปิด = ทุกงานเป็นสีเดียว)
        </label>
        <ul className="tone-list" aria-disabled={!display.statusColors}>
          {TONES.map(({ tone, label, hint }) => (
            <li key={tone} className={display.statusColors ? '' : 'off'}>
              <label className="row">
                <Checkbox disabled={!display.statusColors} checked={display.tones[tone].show} onChange={(show) => setTone(tone, { show })} />
                <span className="grow">
                  {label} <span className="muted small">· {hint}</span>
                </span>
              </label>
              <input
                type="color"
                aria-label={`สี ${label}`}
                disabled={!display.statusColors || !display.tones[tone].show}
                value={display.tones[tone].color}
                onChange={(e) => setTone(tone, { color: e.target.value })}
              />
              <span className="swatch" style={{ background: display.statusColors && display.tones[tone].show ? display.tones[tone].color : 'var(--accent-fill)' }}>
                ตัวอย่าง
              </span>
            </li>
          ))}
        </ul>
        <p className="muted small">สถานะที่ปิดไว้จะแสดงเป็นสีกลางเหมือนงานทั่วไป และถูกซ่อนจากคำอธิบายสี ค่าที่ตั้งไว้จะถูกจำในเบราว์เซอร์นี้</p>
      </div>

      <h3>🐱 เปี๊ยก (แมวประจำแอป)</h3>
      <div className="form">
        <label className="row">
          <Checkbox checked={buddy.visible} onChange={(visible) => onBuddy({ ...buddy, visible })} />
          แสดงเปี๊ยก (เดินเล่นที่ขอบล่างของจอ กดเพื่อทักทาย)
        </label>
        <label className="row">
          <Checkbox disabled={!buddy.visible} checked={buddy.sound} onChange={(sound) => onBuddy({ ...buddy, sound })} />
          🔊 เสียงเมี๊ยวตอนกดทัก (ปิดไว้ก่อนเป็นค่าเริ่มต้น)
        </label>
        <div>
          <button onClick={onWardrobe}>👕 ตู้เสื้อผ้า / ของที่ปลดล็อก</button>
        </div>
        <p className="muted small">เปี๊ยกพูดถึงงานของวันนี้ตามข้อมูลในเครื่องนี้เท่านั้น ไม่มีอะไรถูกส่งออกไป</p>
      </div>
    </Modal>
  )
}
