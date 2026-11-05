import { useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import { TEAM } from '../lib/teamsMeta'
import { buzz, play } from '../lib/sound'
import { sport } from '../sports'
import { t } from '../i18n'

// A short full-screen moment: a goal ("גוווול!" / "GOOOAL!" with the scorer), or the end of a match.
// Any screen calls celebrate(...); the one overlay in App shows it. Tap to close; it never blocks for long.

export function celebrate(detail) {
  window.dispatchEvent(new CustomEvent('celebrate', { detail }))
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const COLORS = { a: ['#1e6fd9', '#5aa2ff', '#ffffff', '#ffd23f'], b: ['#f07a1a', '#ffb347', '#ffffff', '#ffd23f'] }

function Confetti({ team }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas || reducedMotion()) return
    const dpr = window.devicePixelRatio || 1
    const w = (canvas.width = window.innerWidth * dpr)
    const h = (canvas.height = window.innerHeight * dpr)
    const c = canvas.getContext('2d')
    const colors = COLORS[team] ?? [...COLORS.a, ...COLORS.b]
    const bits = Array.from({ length: 140 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.55,
      vx: (Math.random() - 0.5) * 22 * dpr,
      vy: (-12 - Math.random() * 16) * dpr,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      s: (5 + Math.random() * 7) * dpr,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))
    let frame
    const step = () => {
      c.clearRect(0, 0, w, h)
      for (const b of bits) {
        b.vy += 0.55 * dpr
        b.vx *= 0.99
        b.x += b.vx
        b.y += b.vy
        b.r += b.vr
        c.save()
        c.translate(b.x, b.y)
        c.rotate(b.r)
        c.fillStyle = b.color
        c.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2)
        c.restore()
      }
      if (bits.some((b) => b.y < h + 40)) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [team])
  return <canvas ref={ref} className="confetti" aria-hidden="true" />
}

export default function Celebration() {
  const [shown, setShown] = useState(null)

  // One at a time: the winning goal plays out before the trophy shows.
  const queue = useRef([])
  const timer = useRef(null)

  useEffect(() => {
    const next = () => {
      const d = queue.current.shift()
      if (!d) {
        timer.current = null
        return setShown(null)
      }
      setShown({ ...d, key: Date.now() })
      if (d.kind === 'goal') {
        play('goal')
        buzz([80, 40, 160])
      } else if (d.kind === 'win') {
        play('final')
        setTimeout(() => play('win'), 1200)
        buzz([200, 80, 200])
      }
      timer.current = setTimeout(next, d.kind === 'win' ? 3200 : 2400)
    }
    const on = (e) => {
      queue.current.push(e.detail)
      if (!timer.current) next()
    }
    const skip = () => {
      clearTimeout(timer.current)
      next()
    }
    window.addEventListener('celebrate', on)
    window.addEventListener('celebrate-skip', skip)
    return () => {
      window.removeEventListener('celebrate', on)
      window.removeEventListener('celebrate-skip', skip)
      clearTimeout(timer.current)
    }
  }, [])

  if (!shown) return null
  const team = TEAM[shown.team]

  return (
    <div key={shown.key} className={`celebration ${shown.kind} team-${shown.team}`} onClick={() => window.dispatchEvent(new Event('celebrate-skip'))} role="status">
      <Confetti team={shown.team} />
      {shown.kind === 'goal' ? (
        <div className="celebration-body">
          <div className="celebration-word">{sport.words.cheer}</div>
          {shown.player && <Avatar player={shown.player} size={110} />}
          <div className="celebration-name">{shown.player ? shown.player.name : team?.name}</div>
          {shown.score && <Score score={shown.score} />}
        </div>
      ) : (
        <div className="celebration-body">
          <div className="celebration-trophy">🏆</div>
          <div className="celebration-word small">{team ? t('match.teamWins', { team: team.name }) : t('match.fullTime')}</div>
          {shown.score && <Score score={shown.score} />}
        </div>
      )}
    </div>
  )
}

// Same sides as the scoreboard: the blue team on the right.
function Score({ score }) {
  return (
    <div className="celebration-score">
      <span>{score.a}</span>
      <span>–</span>
      <span>{score.b}</span>
    </div>
  )
}
