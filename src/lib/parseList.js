// Turns a list pasted from WhatsApp into names, in order.
// Handles "1. name", bullets, hidden direction/joiner characters WhatsApp adds,
// and skips title lines like "שבת 9:30".

const HIDDEN = /[​-‏‪-‮⁠-⁤﻿]/g
const TIME = /\d{1,2}[:.]\d{2}/

export const normalizeName = (name) => name.replace(HIDDEN, '').trim().replace(/\s+/g, ' ').toLowerCase()

export function parseNames(text) {
  const names = []
  const seen = new Set()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(HIDDEN, '').trim()
    if (!line || TIME.test(line)) continue
    const name = line.replace(/^(\d+\s*[.)\-:]?|[-•*·▪️✅⚽]+)\s*/u, '').trim().replace(/\s+/g, ' ')
    // a sentence ("ככה נראית הרשימה שלנו היום") is not a name
    if (!name || name.length > 30 || /^\d+$/.test(name) || name.split(' ').length > 3) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names
}
