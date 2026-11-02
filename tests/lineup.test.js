import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formation } from '../src/lib/lineup.js'

const team = (...positions) => {
  const byId = Object.fromEntries(positions.map((pos, i) => [`x${i}`, { id: `x${i}`, position: pos }]))
  return [Object.keys(byId), byId]
}
const names = (f) => ({ k: f.keeper?.id ?? null, def: f.rows.def.map((p) => p.id), mid: f.rows.mid.map((p) => p.id), att: f.rows.att.map((p) => p.id) })

test('keeper + 5 → 1-2-2-1, each in his position', () => {
  const f = formation(...team('gk', 'def', 'def', 'mid', 'mid', 'att'))
  assert.equal(f.label, '1-2-2-1')
  assert.deepEqual(names(f), { k: 'x0', def: ['x1', 'x2'], mid: ['x3', 'x4'], att: ['x5'] })
  assert.equal(f.rotating, false)
})

test('no keeper-only → rotating, 6 outfield as 2-3-1', () => {
  const f = formation(...team('any', 'any', 'any', 'any', 'any', 'any'))
  assert.equal(f.rotating, true)
  assert.equal(f.label, '2-3-1')
})

test('too many attackers spill into midfield, nobody is lost', () => {
  const f = formation(...team('gk', 'att', 'att', 'att', 'any', 'any'))
  const all = [...f.rows.def, ...f.rows.mid, ...f.rows.att].map((p) => p.id)
  assert.equal(all.length, 5)
  assert.equal(f.rows.att.length, 1)
  assert.equal(f.label, '1-2-2-1')
})

test('5 outfield without keeper (team of 5) → 2-2-1', () => {
  assert.equal(formation(...team('def', 'mid', 'att', 'any', 'any')).label, '2-2-1')
})

test('several positions: a def/mid player fills whichever of his rows has room', () => {
  const byId = {
    a: { id: 'a', positions: ['def'] }, b: { id: 'b', positions: ['def'] }, c: { id: 'c', positions: ['def', 'mid'] },
    d: { id: 'd', positions: ['mid'] }, e: { id: 'e', positions: ['att'] }, f: { id: 'f', positions: ['gk'] },
  }
  const f = formation(Object.keys(byId), byId)
  assert.equal(f.keeper.id, 'f')
  assert.deepEqual(names(f), { k: 'f', def: ['a', 'b'], mid: ['d', 'c'], att: ['e'] })
})
