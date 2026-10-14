import type { Tone } from './group'

export type ToneSetting = { show: boolean; color: string }

// Chosen so white chip text reaches WCAG AA (>= 4.5:1): 5.0, 5.2 and 4.8.
export const DEFAULT_TONES: Record<Tone, ToneSetting> = {
  assigned: { show: true, color: '#15803d' },
  pending: { show: true, color: '#c2410c' },
  unassigned: { show: true, color: '#64748b' },
}

/** Earlier defaults (3.0-3.6:1, too pale for white text). */
const OLD_DEFAULTS: Record<Tone, string> = {
  assigned: '#16a34a',
  pending: '#ea580c',
  unassigned: '#8b95a3',
}

/**
 * A saved colour equal to an old default was never customised (settings are saved whole, so it
 * got stored along with any other change). Move it to the new default; real choices are kept.
 */
export function migrateToneColor(tone: Tone, saved: string | undefined): string {
  if (!saved || saved.toLowerCase() === OLD_DEFAULTS[tone]) return DEFAULT_TONES[tone].color
  return saved
}

/** WCAG contrast ratio of white text on a #rrggbb background. */
export function contrastWithWhite(hex: string): number {
  const lin = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 1.05 / (0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5) + 0.05)
}
