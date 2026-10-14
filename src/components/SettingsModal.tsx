import Modal from './Modal'
import { DEFAULT_TONES, type DisplaySettings } from '../lib/db'
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
  onClose: () => void
}

const TONES: { tone: Tone; label: string; hint: string }[] = [
  { tone: 'assigned', label: 'จัดรถแล้ว', hint: 'มีคนขับหรือรถแล้ว' },
  { tone: 'pending', label: 'ขึ้นค้าง', hint: 'สถานะมีคำว่า “ค้าง”' },
  { tone: 'unassigned', label: 'ยังไม่จัดรถ', hint: 'ยังไม่มีคนขับ/รถ' },
]

export default function SettingsModal({ display, era, theme, groupBy, groupChoices, onEra, onTheme, onGroupBy, onChange, onClose }: Props) {
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
            <select value={groupBy} onChange={(e) => onGroupBy(e.target.value as GroupBy)}>
              {groupChoices.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            ปีที่แสดง
            <select value={era} onChange={(e) => onEra(e.target.value as Era)}>
              <option value="BE">พ.ศ.</option>
              <option value="CE">ค.ศ.</option>
            </select>
          </label>
        </div>
      </div>

      <h3>สีสถานะงานบนปฏิทิน</h3>
      <div className="form">
        <label className="row">
          <input type="checkbox" checked={display.statusColors} onChange={(e) => onChange({ ...display, statusColors: e.target.checked })} />
          แสดงสีตามสถานะ (ปิด = ทุกงานเป็นสีเดียว)
        </label>
        <ul className="tone-list" aria-disabled={!display.statusColors}>
          {TONES.map(({ tone, label, hint }) => (
            <li key={tone} className={display.statusColors ? '' : 'off'}>
              <label className="row">
                <input
                  type="checkbox"
                  disabled={!display.statusColors}
                  checked={display.tones[tone].show}
                  onChange={(e) => setTone(tone, { show: e.target.checked })}
                />
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
    </Modal>
  )
}
