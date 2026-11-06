// "Add to calendar": the weekly game as a repeating event, from the next game day on.
// Apple phones and Macs get an .ics file (the Calendar app opens it); everyone else gets
// Google Calendar's "new event" page, which opens the Calendar app on Android.

const HOURS = 2 // how long the event is: a usual morning of games

const pad = (n) => String(n).padStart(2, '0')
// 'YYYY-MM-DD' + 'H:MM' → 'YYYYMMDDTHHMM00', local time (no time zone: the phone's own).
function stamp(day, kickoff, plusHours = 0) {
  const [y, m, d] = day.split('-').map(Number)
  const [h, min] = kickoff.split(':').map(Number)
  const t = new Date(y, m - 1, d, h + plusHours, min)
  return `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}T${pad(t.getHours())}${pad(t.getMinutes())}00`
}

// The event's fields. game: { day, kickoff, title, venue?, details?, url? }
function eventOf(game) {
  return {
    start: stamp(game.day, game.kickoff),
    end: stamp(game.day, game.kickoff, HOURS),
    title: game.title,
    location: game.venue || '',
    details: [game.details, game.url].filter(Boolean).join('\n'),
  }
}

export function googleCalendarUrl(game) {
  const e = eventOf(game)
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${e.start}/${e.end}`, recur: 'RRULE:FREQ=WEEKLY' })
  if (e.details) q.set('details', e.details)
  if (e.location) q.set('location', e.location)
  try {
    q.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone)
  } catch {
    // Google uses the calendar's own time zone
  }
  return `https://calendar.google.com/calendar/render?${q}`
}

// iCalendar text escaping, and lines of at most 75 bytes (longer ones go on with a leading space).
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
const bytes = (s) => new TextEncoder().encode(s).length
function fold(line) {
  const out = []
  let cur = ''
  for (const ch of line) {
    if (bytes(cur + ch) > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
    }
    cur += ch
  }
  out.push(cur)
  return out.join('\r\n ')
}
// A short steady id, so adding the same group's game again updates the event instead of doubling it.
function hash(s) {
  let h = 5381
  for (const ch of s) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0
  return h.toString(36)
}

export function icsText(game, now = new Date()) {
  const e = eventOf(game)
  const utc = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//neighborhood-football//game//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:game-${hash(`${game.title}|${game.url ?? ''}`)}@neighborhood-football`,
    `DTSTAMP:${utc}`,
    `DTSTART:${e.start}`,
    `DTEND:${e.end}`,
    'RRULE:FREQ=WEEKLY',
    `SUMMARY:${esc(e.title)}`,
    e.location && `LOCATION:${esc(e.location)}`,
    e.details && `DESCRIPTION:${esc(e.details)}`,
    game.url && `URL:${game.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  return lines.map(fold).join('\r\n') + '\r\n'
}

// Directions to the pitch: Waze in Hebrew (what people use in Israel), Google Maps otherwise.
export function mapsUrl(place, lang) {
  return lang === 'he'
    ? `https://waze.com/ul?q=${encodeURIComponent(place)}&navigate=yes`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`
}

export function isApple(nav = globalThis.navigator) {
  if (!nav) return false
  return /iPhone|iPad|iPod|Macintosh/.test(nav.userAgent ?? '') && !/Android/.test(nav.userAgent ?? '')
}

// Opens the right thing for this phone.
export function addToCalendar(game) {
  if (isApple()) {
    // Safari shows a calendar file with "Add to Calendar"; a Mac opens it in Calendar.
    const url = URL.createObjectURL(new Blob([icsText(game)], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'game.ics'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return
  }
  window.open(googleCalendarUrl(game), '_blank', 'noopener')
}
