// Notification chime synthesised with Web Audio, so there is no audio file to ship.
// Browsers keep an AudioContext suspended until the user has interacted with the page,
// so we create/resume it on the first click or key press.

let ctx: AudioContext | null = null

function getContext(): AudioContext | null {
  if (typeof AudioContext === 'undefined') return null
  ctx ??= new AudioContext()
  return ctx
}

/** Call once at startup: arms the audio context on the first user gesture. */
export function unlockAudio() {
  if (typeof window === 'undefined') return
  const arm = () => {
    void getContext()?.resume()
    window.removeEventListener('pointerdown', arm)
    window.removeEventListener('keydown', arm)
  }
  window.addEventListener('pointerdown', arm)
  window.addEventListener('keydown', arm)
}

/** Two-note chime. Resolves false when audio is unavailable or still blocked by the browser. */
export async function playChime(volume = 0.25): Promise<boolean> {
  const ac = getContext()
  if (!ac) return false
  try {
    if (ac.state === 'suspended') await ac.resume()
  } catch {
    return false
  }
  if (ac.state !== 'running') return false

  const start = ac.currentTime
  ;[880, 1174.66].forEach((freq, i) => {
    const t = start + i * 0.18
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq
    // quick attack and decay so it does not click
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    osc.connect(gain).connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.4)
  })
  return true
}

/** A synthesised "meow" for the app cat: a sawtooth glides up and down through a vowel-like filter. */
export async function playMeow(volume = 0.18): Promise<boolean> {
  const ac = getContext()
  if (!ac) return false
  try {
    if (ac.state === 'suspended') await ac.resume()
  } catch {
    return false
  }
  if (ac.state !== 'running') return false

  const t = ac.currentTime
  const osc = ac.createOscillator()
  const filter = ac.createBiquadFilter()
  const gain = ac.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(420, t)
  osc.frequency.exponentialRampToValueAtTime(820, t + 0.16)
  osc.frequency.exponentialRampToValueAtTime(520, t + 0.5)
  filter.type = 'bandpass'
  filter.Q.value = 4
  filter.frequency.setValueAtTime(900, t)
  filter.frequency.exponentialRampToValueAtTime(1800, t + 0.2)
  filter.frequency.exponentialRampToValueAtTime(1000, t + 0.5)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.05)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
  osc.connect(filter).connect(gain).connect(ac.destination)
  osc.start(t)
  osc.stop(t + 0.6)
  return true
}
