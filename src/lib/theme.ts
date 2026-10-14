import type { Theme } from '../types'

export const THEMES: Theme[] = ['system', 'light', 'dark']
export const THEME_LABEL: Record<Theme, string> = { system: 'ตามระบบ', light: 'สว่าง', dark: 'มืด' }

export const isTheme = (v: unknown): v is Theme => typeof v === 'string' && (THEMES as string[]).includes(v)

/**
 * "system" removes the attribute so the stylesheet follows prefers-color-scheme;
 * light/dark pin the palette via <html data-theme>.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}
