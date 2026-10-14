export type Platform = 'ios' | 'android' | 'desktop'

/** iPadOS 13+ reports a Mac user agent, so touch support is the tell. */
export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export type NotifyState =
  | 'granted'
  | 'denied'
  | 'default'
  /** iOS only delivers web notifications to an app added to the Home Screen */
  | 'ios-install'
  | 'unsupported'

export function notifyState(env: {
  platform: Platform
  standalone: boolean
  hasNotification: boolean
  permission: 'granted' | 'denied' | 'default'
}): NotifyState {
  if (env.platform === 'ios' && !env.standalone) return 'ios-install'
  if (!env.hasNotification) return 'unsupported'
  return env.permission
}

export function currentPlatform(): Platform {
  return detectPlatform(navigator.userAgent, navigator.maxTouchPoints)
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
}

export function currentNotifyState(): NotifyState {
  return notifyState({
    platform: currentPlatform(),
    standalone: isStandalone(),
    hasNotification: typeof Notification !== 'undefined',
    permission: typeof Notification === 'undefined' ? 'default' : Notification.permission,
  })
}
