import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BUDDY_NAME, clickReply, durationMs, isFlurry, nextState, periodOf, pickLine, type BuddyState, type WorkCtx } from '../lib/buddy'
import type { Outfit, Pose, Skin } from '../lib/buddySprite'
import PixelCat from './PixelCat'
import { playMeow } from '../lib/sound'

/** screen pixels per sprite pixel */
const SCALE = 3
/** the box every pose is centred in, so switching pose never makes the cat jump */
const BOX = 28 * SCALE
const SPEED = 46 // px per second while walking

const poseOf = (s: BuddyState, frame: 0 | 1): Pose => {
  switch (s) {
    case 'walk':
      return frame ? 'walkB' : 'walkA'
    case 'play':
      return frame ? 'playB' : 'playA'
    case 'tail':
      return frame ? 'tailB' : 'tailA'
    case 'sit':
      return 'sit'
    default:
      return s // yawn, sleep, happy, stretch, roll, shout each have a pose of the same name
  }
}

type Props = {
  /** meow when poked */
  sound: boolean
  /** today's numbers, for the jokes (stays on this device) */
  ctx: WorkCtx
  /** pokes so far (before this one) */
  pets: number
  /** what it wears and the unlocked moves it may start doing on its own */
  skin: Skin
  outfit: Outfit
  moves: BuddyState[]
  onPet: () => void
  onHide: () => void
}

/** เปี๊ยก: a quiet pixel cat that wanders along the bottom edge, naps, yawns and answers when poked. */
export default function Buddy({ sound, ctx, pets, skin, outfit, moves, onPet, onHide }: Props) {
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const [state, setState] = useState<BuddyState>('sit')
  const [frame, setFrame] = useState<0 | 1>(0)
  const [x, setX] = useState(() => Math.max(8, window.innerWidth - BOX - 24))
  const [dir, setDir] = useState<1 | -1>(-1)
  const [moveMs, setMoveMs] = useState(0)
  const [bubble, setBubble] = useState<{ text: string; id: number } | null>(null)

  const el = useRef<HTMLDivElement>(null)
  const stateRef = useRef<BuddyState>('sit')
  const timer = useRef(0)
  const bubbleTimer = useRef(0)
  const lastLine = useRef<string | null>(null)
  const seq = useRef(0)
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx
  const movesRef = useRef(moves)
  movesRef.current = moves
  const pokes = useRef<number[]>([])

  const say = useCallback((text: string) => {
    lastLine.current = text
    setBubble({ text, id: ++seq.current })
    window.clearTimeout(bubbleTimer.current)
    bubbleTimer.current = window.setTimeout(() => setBubble(null), 6500)
  }, [])

  const left = () => el.current?.getBoundingClientRect().left ?? 0

  /** start an activity and schedule the one after it */
  const go = useCallback(
    (want: BuddyState) => {
      const next = reduced && (want === 'walk' || want === 'play' || want === 'tail') ? 'sit' : want
      stateRef.current = next
      setState(next)
      let ms = durationMs(next, Math.random)
      if (next === 'walk') {
        const max = Math.max(8, window.innerWidth - BOX - 8)
        const from = left()
        let target = 8 + Math.random() * (max - 8)
        // always a visible stroll, not a shuffle
        if (Math.abs(target - from) < 90) target = from < max / 2 ? Math.min(max, from + 180) : Math.max(8, from - 180)
        ms = (Math.abs(target - from) / SPEED) * 1000
        setDir(target >= from ? 1 : -1)
        setMoveMs(ms)
        setX(target)
        ms += 200
      }
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => go(nextState(stateRef.current, periodOf(new Date()), Math.random, movesRef.current)), ms)
    },
    [reduced],
  )

  useEffect(() => {
    go('sit')
    return () => {
      window.clearTimeout(timer.current)
      window.clearTimeout(bubbleTimer.current)
    }
  }, [go])

  // two-frame animations (walking legs, playing paws)
  useEffect(() => {
    if (state !== 'walk' && state !== 'play' && state !== 'tail') return
    const id = window.setInterval(() => setFrame((f) => (f ? 0 : 1)), state === 'walk' ? 240 : state === 'tail' ? 300 : 380)
    return () => window.clearInterval(id)
  }, [state])

  // nothing runs while the tab is in the background
  useEffect(() => {
    const on = () => {
      if (document.hidden) window.clearTimeout(timer.current)
      else go(nextState(stateRef.current, periodOf(new Date()), Math.random, movesRef.current))
    }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [go])

  // now and then it says something on its own: rarely, and never over a dialog
  useEffect(() => {
    let t = 0
    const schedule = () => {
      t = window.setTimeout(() => {
        if (!document.hidden && !document.querySelector('[role="dialog"]')) say(pickLine(periodOf(new Date()), ctxRef.current, lastLine.current, Math.random, new Date()))
        schedule()
      }, 90_000 + Math.random() * 110_000)
    }
    schedule()
    return () => window.clearTimeout(t)
  }, [say])

  // keep it on screen when the window shrinks
  useEffect(() => {
    const on = () => {
      const max = Math.max(8, window.innerWidth - BOX - 8)
      setX((cur) => (cur > max ? max : cur))
    }
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  function poke() {
    onPet()
    const now = Date.now()
    pokes.current = [...pokes.current.filter((t) => now - t <= 3000), now]
    const r = clickReply(stateRef.current, periodOf(new Date()), ctxRef.current, pets + 1, Math.random, isFlurry(pokes.current, now))
    // stop where it stands instead of finishing the walk
    setMoveMs(0)
    setX(left())
    say(r.line)
    go(r.next)
    if (sound) void playMeow()
  }

  const rightHalf = x > window.innerWidth / 2

  return (
    <div ref={el} className="buddy" style={{ transform: `translateX(${x}px)`, transitionDuration: `${moveMs}ms` }}>
      {bubble && (
        <div key={bubble.id} className={`buddy-bubble ${rightHalf ? 'right' : ''}`} role="status">
          <span>{bubble.text}</span>
          <button className="icon" onClick={onHide} aria-label={`ซ่อน${BUDDY_NAME}`} title={`ซ่อน${BUDDY_NAME}`}>
            ✕
          </button>
        </div>
      )}
      <button className={`buddy-btn buddy-${state}`} onClick={poke} aria-label={`${BUDDY_NAME} แมวประจำแอป กดเพื่อทักทาย`}>
        <span style={{ display: 'inline-block', transform: state === 'walk' && dir < 0 ? 'scaleX(-1)' : undefined }}>
          <PixelCat pose={poseOf(state, frame)} outfit={outfit} skin={skin} scale={SCALE} />
        </span>
        {state === 'sleep' && <span className="buddy-fx buddy-z" aria-hidden>z Z</span>}
        {(state === 'happy' || state === 'roll') && <span className="buddy-fx buddy-heart" aria-hidden>♥</span>}
      </button>
    </div>
  )
}
