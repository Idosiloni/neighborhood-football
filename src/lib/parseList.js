// Turns a list pasted from WhatsApp into names, in order.
// Handles "1. name", bullets, emoji, hidden direction/joiner characters WhatsApp adds,
// and skips title lines and sentences in Hebrew or English ("שבת 9:30", "Saturday 9:30",
// "Sat 9am", "Here's the list for today", "Today's list:"), whatever language the app shows.

const HIDDEN = /[​-‏‪-‮⁠-⁤﻿]/g
// 9:30, 21.00, 9am, 9:30 PM
const TIME = /\d{1,2}[:.]\d{2}|\b\d{1,2}\s*[ap]\.?m\b/i
// 7/11, 11/7/26
const DATE = /\b\d{1,2}\/\d{1,2}\b/
// A line starting with a day: "Saturday", "Sat.", "Sun 9:30", "יום שבת", "שבת בבוקר".
// (Not every Hebrew day: "שני" is also a name.)
const DAY = /^(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b|^(יום|שישי|שבת)(\s|$)/i
// Words that are never part of a name in a sign-up list ("Game today", "הרשימה להיום").
const NOT_NAMES = new Set([
  'the', 'for', 'list', 'today', "today's", 'tonight', "tonight's", 'tomorrow', 'here', "here's", 'heres',
  "who's", 'whos', 'game', 'games', 'match', 'players', 'coming', 'signup', 'sign-up', 'please', 'is', 'are',
  'our', 'this', 'week', 'pickup', 'soccer', 'football',
  'רשימה', 'הרשימה', 'היום', 'להיום', 'הערב', 'מחר', 'משחק', 'כדורגל',
])
// Emoji and symbols around a name ("✅ Dan", "Avi ⚽").
const SYMBOLS = /^[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\s]+|[\p{Extended_Pictographic}\u{FE0F}\u{20E3}\s]+$/gu

export const normalizeName = (name) => name.replace(HIDDEN, '').trim().replace(/\s+/g, ' ').toLowerCase()

// A title or a sentence, not a name.
function notAName(line) {
  if (TIME.test(line) || DATE.test(line) || DAY.test(line)) return true
  if (/[:?!]$/.test(line)) return true // "Today's list:", "מי מגיע?"
  return line.toLowerCase().replace(/[‘’]/g, "'").split(' ').some((w) => NOT_NAMES.has(w))
}

export function parseNames(text) {
  const names = []
  const seen = new Set()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(HIDDEN, '').trim()
    if (!line) continue
    const name = line
      .replace(/^(\d+\s*[.)\-:]?|[-•*·▪]+)\s*/u, '')
      .replace(SYMBOLS, '')
      .trim()
      .replace(/\s+/g, ' ')
    // a sentence ("ככה נראית הרשימה שלנו היום") is not a name
    if (!name || name.length > 30 || /^\d+$/.test(name) || name.split(' ').length > 3) continue
    if (notAName(line) || notAName(name)) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names
}
