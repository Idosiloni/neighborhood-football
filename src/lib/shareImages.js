// Images to send to the group's WhatsApp: the teams before a game, and the night's results after.
// 1080×1350 JPEGs drawn on a canvas, in the current language and the group's bib colors.
import { isRTL, t } from '../i18n/index.js'
import { PALETTE, teamColor } from './teamColors.js'
import { TEAM } from './teamsMeta.js'

const BODY = "'IBM Plex Sans Hebrew', system-ui, sans-serif"
const DISPLAY = "Karantina, 'IBM Plex Sans Hebrew', system-ui, sans-serif"
const W = 1080
const H = 1350

function text(ctx, str, x, y, { size, weight = 700, color = '#ffffff', align = 'center', font = BODY, dir = isRTL() ? 'rtl' : 'ltr', max } = {}) {
  ctx.save()
  ctx.font = `${weight} ${size}px ${font}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.direction = dir
  let s = String(str)
  if (max) while (s.length > 1 && ctx.measureText(s).width > max) s = s.slice(0, -2) + '…'
  ctx.fillText(s, x, y)
  ctx.restore()
}

function round(ctx, x, y, w, h, r, fill) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
}

// A pitch background with the group's name on top and the app's name at the bottom.
async function canvasWith(title, sub) {
  await Promise.all([document.fonts?.load('700 80px Karantina'), document.fonts?.load("700 40px 'IBM Plex Sans Hebrew'")]).catch(() => {})
  await document.fonts?.ready
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#1f8a4c'
  ctx.fillRect(0, 0, W, H)
  for (let i = 0; i < 10; i++) {
    if (i % 2) continue
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(0, i * (H / 10), W, H / 10)
  }
  text(ctx, title, W / 2, 130, { size: 96, font: DISPLAY, max: W - 120 })
  text(ctx, sub, W / 2, 200, { size: 40, weight: 600, color: 'rgba(255,255,255,0.85)', max: W - 120 })
  text(ctx, t('common.appName'), W / 2, H - 40, { size: 44, font: DISPLAY, color: 'rgba(255,255,255,0.8)' })
  return { canvas, ctx }
}

const toJpeg = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))

// The two teams side by side (in Hebrew team A on the right, like the scoreboard), and who waits.
export async function drawTeams({ title, sub, teamA, teamB, bench }) {
  const { canvas, ctx } = await canvasWith(title, sub)
  const colW = 450
  const gap = 60
  const left = (W - 2 * colW - gap) / 2
  const sides = isRTL() ? [['a', teamA, left + colW + gap], ['b', teamB, left]] : [['a', teamA, left], ['b', teamB, left + colW + gap]]
  const rows = Math.max(teamA.length, teamB.length)
  const rowH = Math.min(100, (H - 620) / Math.max(rows, 1))
  for (const [side, names, x] of sides) {
    const c = PALETTE[teamColor(side)]
    round(ctx, x, 260, colW, 110, 24, c.bg)
    text(ctx, TEAM[side].name, x + colW / 2, 335, { size: 56, color: c.ink, max: colW - 40 })
    round(ctx, x, 390, colW, rowH * rows + 40, 24, 'rgba(255,255,255,0.12)')
    names.forEach((name, i) => text(ctx, name, x + colW / 2, 390 + 20 + rowH * (i + 0.7), { size: Math.min(44, rowH * 0.6), weight: 600, max: colW - 40 }))
  }
  if (bench.length) {
    const y = 390 + rowH * rows + 120
    text(ctx, t('match.share.bench', { names: bench.join(', ') }), W / 2, y, { size: 36, weight: 600, color: 'rgba(255,255,255,0.85)', max: W - 120 })
  }
  return toJpeg(canvas)
}

// The night's games with their scores, then the top scorers and the MVPs.
export async function drawNight({ title, sub, games, scorers, mvps }) {
  const { canvas, ctx } = await canvasWith(title, sub)
  const shown = games.slice(-8) // a long night: the last 8 games
  const rowH = Math.min(130, 720 / Math.max(shown.length, 1))
  let y = 280
  for (const g of shown) {
    round(ctx, 90, y, W - 180, rowH - 16, 20, 'rgba(255,255,255,0.12)')
    const mid = y + rowH / 2 + 4
    const a = PALETTE[teamColor('a')]
    const b = PALETTE[teamColor('b')]
    // Same sides as the scoreboard: team A on the right in Hebrew, on the left in English.
    const [ax, bx] = isRTL() ? [W - 150, 150] : [150, W - 150]
    text(ctx, TEAM.a.name, ax, mid, { size: 38, color: g.winner === 'a' ? '#ffffff' : 'rgba(255,255,255,0.75)', align: isRTL() ? 'right' : 'left', max: 330 })
    text(ctx, TEAM.b.name, bx, mid, { size: 38, color: g.winner === 'b' ? '#ffffff' : 'rgba(255,255,255,0.75)', align: isRTL() ? 'left' : 'right', max: 330 })
    const left = isRTL() ? g.b : g.a
    const right = isRTL() ? g.a : g.b
    text(ctx, `${left} – ${right}`, W / 2, mid + 6, { size: 64, font: DISPLAY, dir: 'ltr' })
    round(ctx, isRTL() ? W - 110 : 100, y + 18, 10, rowH - 52, 5, a.bg)
    round(ctx, isRTL() ? 100 : W - 110, y + 18, 10, rowH - 52, 5, b.bg)
    y += rowH
  }
  y += 40
  if (scorers.length) {
    text(ctx, `⚽ ${scorers.map((s) => `${s.name} ${s.goals}`).join(' · ')}`, W / 2, y, { size: 40, weight: 600, max: W - 140 })
    y += 70
  }
  if (mvps.length) text(ctx, `🌟 MVP: ${mvps.join(', ')}`, W / 2, y, { size: 40, weight: 600, max: W - 140 })
  return toJpeg(canvas)
}

// Opens the phone's share menu with the image (WhatsApp is right there), or downloads it.
export async function shareImage(blob, fileName, message) {
  const file = new File([blob], fileName, { type: 'image/jpeg' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: message })
      return 'shared'
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}
