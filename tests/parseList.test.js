import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseNames, normalizeName } from '../src/lib/parseList.js'

// A list as WhatsApp pastes it (with the hidden U+2060 after the numbers).
const LIST = 'שבת 9:30\n1. אבי\n2. ⁠ברק\n3. ⁠גל\n4. ⁠דור\n5. ⁠הלל\n6. ⁠בר לב\n7. ⁠זאב\n8. חן\n9. ⁠טל\n10. ⁠יואב\n11. ⁠כפיר\n12. ⁠ליאור\n13. ⁠מתן\n14. ⁠נועם'

test('WhatsApp list: 14 clean names in order, title skipped', () => {
  const names = parseNames(LIST)
  assert.deepEqual(names, ['אבי', 'ברק', 'גל', 'דור', 'הלל', 'בר לב', 'זאב', 'חן', 'טל', 'יואב', 'כפיר', 'ליאור', 'מתן', 'נועם'])
  assert.ok(names.every((n) => !/[⁠‏‎]/.test(n)))
})

test('bullets, extra spaces, duplicates and empty lines', () => {
  assert.deepEqual(parseNames('- אבי\n• משה  כהן\n\n1) אבי\n3- דני\n✅ רון'), ['אבי', 'משה כהן', 'דני', 'רון'])
})

test('plain names without numbers', () => {
  assert.deepEqual(parseNames('יוסי\nבני\n'), ['יוסי', 'בני'])
})

test('normalizeName ignores hidden characters, case and spaces', () => {
  assert.equal(normalizeName('⁠בר  לב '), normalizeName('בר לב'))
})

test('a sentence pasted along with the list is not a name', () => {
  assert.deepEqual(parseNames('1. אבי\n2. בר לב\nככה נראת רשימה שלנו היום'), ['אבי', 'בר לב'])
})
