import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fromPositions, positionsOf, positionsText } from '../src/lib/positions.js'

test('positionsOf: the list, or the old single position + can_gk for older rows', () => {
  assert.deepEqual(positionsOf({ positions: ['mid', 'def'] }), ['def', 'mid'])
  assert.deepEqual(positionsOf({ positions: [], position: 'any', can_gk: false }), [])
  assert.deepEqual(positionsOf({ position: 'gk' }), ['gk'])
  assert.deepEqual(positionsOf({ position: 'def', can_gk: true }), ['gk', 'def'])
  assert.deepEqual(positionsOf({ position: 'any', can_gk: true }), ['gk', 'def', 'mid', 'att'])
})

test('fromPositions: only goalkeeper = keeper-only; one field position = that; else any', () => {
  assert.deepEqual(fromPositions(['gk']), { positions: ['gk'], position: 'gk', can_gk: true })
  assert.deepEqual(fromPositions(['mid', 'gk']), { positions: ['gk', 'mid'], position: 'mid', can_gk: true })
  assert.deepEqual(fromPositions(['def', 'mid']), { positions: ['def', 'mid'], position: 'any', can_gk: false })
  assert.deepEqual(fromPositions([]), { positions: [], position: 'any', can_gk: false })
})

test('positionsText: plain words, no "joker"', () => {
  assert.equal(positionsText({ positions: ['def', 'mid'] }), 'הגנה · קישור')
  assert.equal(positionsText({ positions: ['def', 'mid'] }, { short: true }), 'בלם/קשר')
  assert.equal(positionsText({ positions: ['gk'] }), 'שוער קבוע')
  assert.equal(positionsText({ positions: [] }, { short: true }), 'כל מקום')
  assert.equal(positionsText({ positions: ['gk', 'def', 'mid', 'att'] }), 'כל מקום, גם בשער')
  assert.ok(!/ג.?וקר/.test(positionsText({ positions: [] })))
})
