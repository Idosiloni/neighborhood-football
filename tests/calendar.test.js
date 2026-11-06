import { test } from 'node:test'
import assert from 'node:assert/strict'
import { googleCalendarUrl, icsText, isApple, mapsUrl } from '../src/lib/calendar.js'

const game = { day: '2026-11-07', kickoff: '9:30', title: '⚽ שכונה, שבת; כיף', venue: 'מגרש הספורטק', details: 'משחק', url: 'https://example.test/' }

test('calendar: the .ics is a weekly event at the game time, two hours long', () => {
  const ics = icsText(game, new Date('2026-11-01T10:00:00Z'))
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/)
  assert.match(ics, /\r\nDTSTART:20261107T093000\r\n/)
  assert.match(ics, /\r\nDTEND:20261107T113000\r\n/)
  assert.match(ics, /\r\nRRULE:FREQ=WEEKLY\r\n/)
  assert.match(ics, /\r\nDTSTAMP:20261101T100000Z\r\n/)
  assert.match(ics, /SUMMARY:⚽ שכונה\\, שבת\\; כיף/)
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
})

test('calendar: long Hebrew lines fold at 75 bytes', () => {
  const ics = icsText({ ...game, details: 'מילה '.repeat(60) })
  const enc = new TextEncoder()
  for (const line of ics.split('\r\n')) assert.ok(enc.encode(line).length <= 75, line)
  // Unfolded, the text is whole again.
  assert.ok(ics.replace(/\r\n /g, '').includes(`DESCRIPTION:${'מילה '.repeat(60)}\\n`))
})

test('calendar: the same group gets the same event id (adding again updates it)', () => {
  const uid = (s) => s.match(/UID:(.*)\r\n/)[1]
  assert.equal(uid(icsText(game)), uid(icsText({ ...game, venue: 'אחר' })))
  assert.notEqual(uid(icsText(game)), uid(icsText({ ...game, title: 'אחרת' })))
})

test('calendar: the Google link has the times and repeats weekly', () => {
  const u = new URL(googleCalendarUrl(game))
  assert.equal(u.searchParams.get('dates'), '20261107T093000/20261107T113000')
  assert.equal(u.searchParams.get('recur'), 'RRULE:FREQ=WEEKLY')
  assert.equal(u.searchParams.get('location'), 'מגרש הספורטק')
})

test('calendar: a kickoff late at night ends on the next day', () => {
  assert.match(icsText({ ...game, kickoff: '23:00' }), /DTEND:20261108T010000/)
})

test('calendar: Apple phones and Macs get the file, Android does not', () => {
  assert.equal(isApple({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }), true)
  assert.equal(isApple({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }), true)
  assert.equal(isApple({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' }), false)
})

test('maps: Waze in Hebrew, Google Maps otherwise', () => {
  assert.match(mapsUrl('מגרש הספורטק', 'he'), /^https:\/\/waze\.com\/ul\?q=/)
  assert.match(mapsUrl('Riverside Park', 'en'), /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=Riverside%20Park/)
})
