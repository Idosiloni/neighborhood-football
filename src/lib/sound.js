// Game sounds, made in the browser (no files to download): referee whistles, the crowd on a goal,
// the last seconds of a match. Phones only allow sound after a tap, so the first tap anywhere
// unlocks it (unlockSound in main.jsx). Each phone can switch sounds off in "אני".

const KEY = 'sound-off'
let ctx = null

export function soundOn() {
  try {
    return localStorage.getItem(KEY) !== '1'
  } catch {
    return true
  }
}

export function setSoundOn(on) {
  try {
    if (on) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, '1')
  } catch {
    // private mode: stays on for this visit
  }
  if (on) play('whistle')
}

export function unlockSound() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  ctx ??= new AC()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  // Have the chosen goal recording ready before the first goal.
  const g = GOAL_SOUNDS.find((x) => x.id === goalSound())
  if (g?.file && soundOn()) loadClip(g.file)
}

// A short buzz on phones that support it (not iPhones).
export function buzz(pattern) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // ignore
  }
}

function tone({ freq, type = 'sine', at = 0, dur = 0.2, gain = 0.2, slideTo, vibrato = 0 }) {
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  if (vibrato) {
    // the pea in a referee's whistle: a fast wobble in pitch
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    lfo.frequency.value = 28
    depth.gain.value = vibrato
    lfo.connect(depth).connect(osc.frequency)
    lfo.start(t)
    lfo.stop(t + dur)
  }
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02)
  g.gain.setValueAtTime(gain, t + Math.max(0.02, dur - 0.06))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

// Pink noise: softer than plain hiss, closer to a crowd of voices.
function pinkNoise(dur) {
  const len = Math.floor(ctx.sampleRate * dur)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1
    b0 = 0.99765 * b0 + white * 0.099046
    b1 = 0.963 * b1 + white * 0.2965164
    b2 = 0.57 * b2 + white * 1.0526913
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11
  }
  return buf
}

// A crowd roaring: two layers of noise (the rumble and the voices), swelling up, then dying down,
// with a little wobble like many people shouting at once.
function crowd({ at = 0, dur = 3, gain = 0.5 }) {
  const t = ctx.currentTime + at
  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, t)
  out.gain.exponentialRampToValueAtTime(gain, t + 0.35)
  out.gain.setValueAtTime(gain, t + dur * 0.45)
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  out.connect(ctx.destination)

  const layers = [
    { type: 'lowpass', freq: 500, q: 0.7, level: 1 }, // rumble
    { type: 'bandpass', freq: 1100, q: 1.2, level: 0.8 }, // voices
  ]
  for (const l of layers) {
    const src = ctx.createBufferSource()
    src.buffer = pinkNoise(dur)
    const f = ctx.createBiquadFilter()
    f.type = l.type
    f.frequency.value = l.freq
    f.Q.value = l.q
    const g = ctx.createGain()
    g.gain.value = l.level
    src.connect(f).connect(g).connect(out)
    src.start(t)
  }
  // the wobble
  const lfo = ctx.createOscillator()
  const depth = ctx.createGain()
  lfo.frequency.value = 7
  depth.gain.value = gain * 0.15
  lfo.connect(depth).connect(out.gain)
  lfo.start(t)
  lfo.stop(t + dur)
}

// Brass-like note: a buzzy wave through a filter that opens and closes, so it sounds blown.
function brass({ freq, at = 0, dur = 0.3, gain = 0.12 }) {
  const t = ctx.currentTime + at
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.Q.value = 2
  f.frequency.setValueAtTime(freq * 1.5, t)
  f.frequency.exponentialRampToValueAtTime(freq * 6, t + 0.05)
  f.frequency.exponentialRampToValueAtTime(freq * 2.5, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.03)
  g.gain.setValueAtTime(gain, t + dur - 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  f.connect(g).connect(ctx.destination)
  for (const detune of [-6, 6]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = freq
    o.detune.value = detune
    o.connect(f)
    o.start(t)
    o.stop(t + dur + 0.02)
  }
}

// A stadium air horn: low, wide, two notes a fifth apart, rounded off by a filter.
function horn({ at = 0, dur = 1.1, gain = 0.09 }) {
  const t = ctx.currentTime + at
  const f = ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 900
  f.Q.value = 0.8
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.04)
  g.gain.setValueAtTime(gain, t + dur - 0.25)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  f.connect(g).connect(ctx.destination)
  for (const [freq, detune] of [[185, -8], [185, 8], [277, 0]]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(freq, t)
    o.frequency.setValueAtTime(freq, t + dur - 0.25)
    o.frequency.exponentialRampToValueAtTime(freq * 0.94, t + dur) // sags as the air runs out
    o.detune.value = detune
    o.connect(f)
    o.start(t)
    o.stop(t + dur + 0.02)
  }
}

// Real recordings (public/sounds, CC0, see CREDITS.md): fetched once at the first tap, kept decoded.
const clips = new Map() // file → AudioBuffer | Promise
function loadClip(file) {
  if (!clips.has(file)) {
    const p = fetch(`${import.meta.env.BASE_URL}${file}`)
      .then((r) => r.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buf) => (clips.set(file, buf), buf))
      .catch(() => (clips.delete(file), null))
    clips.set(file, p)
  }
  return clips.get(file)
}

// Plays a recording; while it is still loading (or offline), the made-up crowd instead.
function clip(file, fallback) {
  const buf = clips.get(file)
  if (buf instanceof AudioBuffer) {
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.value = 0.9
    src.connect(g).connect(ctx.destination)
    src.start()
  } else {
    loadClip(file)
    fallback()
  }
}

// The goal sound each phone picked (in "אני").
export const GOAL_SOUNDS = [
  { id: 'stadium', label: '🏟️ אצטדיון', file: 'sounds/goal-stadium.m4a' },
  { id: 'cheer', label: '🎉 קהל חוגג', file: 'sounds/goal-cheer.m4a' },
  { id: 'fanfare', label: '🎺 תרועה', synth: () => {
    ;[[392, 0, 0.16], [523, 0.17, 0.16], [659, 0.34, 0.16], [784, 0.51, 0.7]].forEach(([freq, at, dur]) => brass({ freq, at, dur }))
    crowd({ at: 0.4, dur: 2.4, gain: 0.3 })
  } },
]
const playGoal = (g) => (g.file ? clip(g.file, () => { crowd({ dur: 3.2 }); horn({ at: 0.05 }) }) : g.synth())
const GOAL_KEY = 'goal-sound'

export function goalSound() {
  try {
    return localStorage.getItem(GOAL_KEY) || GOAL_SOUNDS[0].id
  } catch {
    return GOAL_SOUNDS[0].id
  }
}

export function setGoalSound(id) {
  try {
    localStorage.setItem(GOAL_KEY, id)
  } catch {
    // stays the default
  }
}

const SOUNDS = {
  whistle: () => tone({ freq: 2900, dur: 0.35, gain: 0.12, vibrato: 140 }),
  // kick-off: two short blasts
  kickoff: () => {
    tone({ freq: 2900, dur: 0.18, gain: 0.12, vibrato: 140 })
    tone({ freq: 2900, at: 0.26, dur: 0.45, gain: 0.12, vibrato: 140 })
  },
  // full time: three blasts, the last one long
  final: () => {
    tone({ freq: 2800, dur: 0.22, gain: 0.12, vibrato: 140 })
    tone({ freq: 2800, at: 0.32, dur: 0.22, gain: 0.12, vibrato: 140 })
    tone({ freq: 2800, at: 0.64, dur: 0.9, gain: 0.12, vibrato: 140 })
  },
  goal: () => playGoal(GOAL_SOUNDS.find((g) => g.id === goalSound()) ?? GOAL_SOUNDS[0]),
  win: () => [523, 659, 784, 1047].forEach((freq, i) => brass({ freq, at: i * 0.13, dur: i === 3 ? 0.6 : 0.2, gain: 0.1 })),
  tick: () => tone({ freq: 1200, type: 'square', dur: 0.06, gain: 0.05 }),
  reveal: () => tone({ freq: 300, type: 'triangle', dur: 0.35, gain: 0.12, slideTo: 1200 }),
  pop: () => tone({ freq: 660, type: 'sine', dur: 0.09, gain: 0.12, slideTo: 990 }),
}

// Plays one of the goal sounds now (trying them out in "אני").
export async function preview(goalId) {
  try {
    unlockSound()
    const g = GOAL_SOUNDS.find((x) => x.id === goalId)
    if (g?.file) await loadClip(g.file) // the real one, even on the first tap
    if (g) playGoal(g)
  } catch {
    // ignore
  }
}

export function play(name) {
  if (!soundOn()) return
  try {
    unlockSound()
    if (!ctx || ctx.state !== 'running') return
    SOUNDS[name]?.()
  } catch {
    // sound is a bonus: never break the app for it
  }
}
