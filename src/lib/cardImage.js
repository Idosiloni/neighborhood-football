// Draws a player's FIFA-style card as a JPEG (1080×1350) for sharing on WhatsApp / Instagram.
import { positionsText } from './positions.js'
import { loadPhoto } from './photos.js'

const TIERS = {
  gold: ['#f7dc7a', '#b8892a', '#2b1f05'],
  silver: ['#e4e9ec', '#8b979e', '#1a2126'],
  bronze: ['#e0a57a', '#8a5232', '#2a1408'],
  new: ['#2ba35e', '#146438', '#ffffff'],
}
const BODY = "'IBM Plex Sans Hebrew', system-ui, sans-serif"
const DISPLAY = "Karantina, 'IBM Plex Sans Hebrew', system-ui, sans-serif"

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function cardPath(ctx, x, y, w, h) {
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y)
  ctx.lineTo(x + w, y + h * 0.06)
  ctx.lineTo(x + w, y + h * 0.88)
  ctx.lineTo(x + w / 2, y + h)
  ctx.lineTo(x, y + h * 0.88)
  ctx.lineTo(x, y + h * 0.06)
  ctx.closePath()
}

function text(ctx, str, x, y, { size, weight = 700, color, align = 'center', alpha = 1, font = BODY }) {
  ctx.save()
  ctx.font = `${weight} ${size}px ${font}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.globalAlpha = alpha
  ctx.direction = 'rtl'
  ctx.fillText(str, x, y)
  ctx.restore()
}

export async function drawCard({ player, overall, tier, attrs, traits, line }) {
  await Promise.all([document.fonts?.load('700 80px Karantina'), document.fonts?.load("700 40px 'IBM Plex Sans Hebrew'")]).catch(() => {})
  const W = 1080
  const H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const [c1, c2, ink] = TIERS[tier] ?? TIERS.new

  // Background: a freshly mown pitch with chalk lines.
  ctx.fillStyle = '#1f8a4c'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#239552'
  for (let x = 0; x < W; x += 180) ctx.fillRect(x, 0, 90, H)
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(0, H * 0.55)
  ctx.lineTo(W, H * 0.55)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(W / 2, H * 0.55, 230, 0, Math.PI * 2)
  ctx.stroke()

  // Card.
  const cw = 760
  const ch = 1040
  const cx = (W - cw) / 2
  const cy = 70
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 50
  ctx.shadowOffsetY = 24
  cardPath(ctx, cx, cy, cw, ch)
  const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch)
  g.addColorStop(0, c1)
  g.addColorStop(1, c2)
  ctx.fillStyle = g
  ctx.fill()
  ctx.restore()

  // Photo (or emoji), fading into the card at the bottom.
  const px = cx + cw / 2 - 40
  const py = cy + 120
  const ps = 400
  ctx.save()
  cardPath(ctx, cx, cy, cw, ch)
  ctx.clip()
  const photo = await loadPhoto(player).catch(() => null)
  if (photo) {
    const img = await loadImage(photo)
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(px - ps / 2, py, ps, ps, [ps / 2, ps / 2, 30, 30])
    ctx.clip()
    ctx.drawImage(img, px - ps / 2, py, ps, ps)
    const fade = ctx.createLinearGradient(0, py + ps * 0.7, 0, py + ps)
    fade.addColorStop(0, 'rgba(0,0,0,0)')
    fade.addColorStop(1, c2)
    ctx.fillStyle = fade
    ctx.fillRect(px - ps / 2, py, ps, ps)
    ctx.restore()
  } else {
    ctx.font = `260px ${BODY}`
    ctx.textAlign = 'center'
    ctx.fillText(player.emoji || '⚽', px, py + 300)
  }
  ctx.restore()

  // Rating and position (right side, as on the screen).
  const rx = cx + cw - 120
  text(ctx, overall == null ? '?' : String(overall), rx, cy + 240, { size: 170, color: ink, font: DISPLAY })
  text(ctx, positionsText(player, { short: true }), rx, cy + 295, { size: 44, color: ink })

  // Name, nickname, line under the name.
  text(ctx, player.name, W / 2, cy + 610, { size: 130, color: ink, font: DISPLAY })
  ctx.fillStyle = ink
  ctx.globalAlpha = 0.5
  ctx.fillRect(cx + 110, cy + 630, cw - 220, 3)
  ctx.globalAlpha = 1
  if (player.nickname) text(ctx, `״${player.nickname}״`, W / 2, cy + 690, { size: 44, weight: 600, color: ink, alpha: 0.9 })

  // The six stats, 3 per row, right to left: number on top, label under it.
  attrs.forEach((a, i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const ax = cx + cw - 150 - col * 230
    const ay = cy + 770 + row * 120
    ctx.save()
    ctx.direction = 'ltr'
    text(ctx, String(a.value), ax, ay, { size: 84, color: ink, font: DISPLAY })
    ctx.restore()
    text(ctx, a.label, ax, ay + 40, { size: 30, weight: 700, color: ink, alpha: 0.8 })
  })

  // Under the card: fun badges and the funny line.
  if (traits.length) text(ctx, traits.map((t) => `${t.emoji} ${t.label}`).join('   '), W / 2, cy + ch + 80, { size: 40, weight: 600, color: '#ffffff' })
  text(ctx, line, W / 2, cy + ch + 140, { size: 36, weight: 400, color: 'rgba(255,255,255,0.85)' })
  text(ctx, 'כדורגל שכונה', W / 2, H - 30, { size: 48, color: '#ffffff', font: DISPLAY })

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
}

// Opens the phone's share menu with the image, or downloads it where sharing files isn't supported.
export async function shareCard(blob, name) {
  const file = new File([blob], `${name}-card.jpg`, { type: 'image/jpeg' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `הכרטיס של ${name} ⚽` })
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
