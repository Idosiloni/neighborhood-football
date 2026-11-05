import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createSync } from '../src/lib/sync.js'

const tick = () => new Promise((r) => setTimeout(r, 0))

// A send that waits until released, so taps can land while it runs.
function slowSend() {
  const calls = []
  let release
  const send = (key, want) => {
    calls.push([key, want])
    return new Promise((r) => (release = r))
  }
  return { calls, send, release: async () => { release(); await tick() } }
}

test('one tap sends once and settles', async () => {
  const s = slowSend()
  const settled = []
  const set = createSync(s.send, (key, failed) => settled.push([key, failed]))
  set('me', true)
  assert.deepEqual(s.calls, [['me', true]])
  await s.release()
  assert.deepEqual(settled, [['me', false]])
})

test('taps while saving: only the last wish is sent after', async () => {
  const s = slowSend()
  const settled = []
  const set = createSync(s.send, (key) => settled.push(key))
  set('me', true)
  set('me', false)
  set('me', true)
  set('me', false)
  assert.equal(s.calls.length, 1)
  await s.release()
  assert.deepEqual(s.calls, [['me', true], ['me', false]])
  assert.equal(settled.length, 0)
  await s.release()
  assert.deepEqual(settled, ['me'])
})

test('back to the first wish while saving: no second send', async () => {
  const s = slowSend()
  const set = createSync(s.send, () => {})
  set('me', true)
  set('me', false)
  set('me', true)
  await s.release()
  assert.deepEqual(s.calls, [['me', true]])
})

test('different keys are saved side by side', async () => {
  const calls = []
  const set = createSync(async (k, w) => calls.push([k, w]), () => {})
  set('a', true)
  set('b', true)
  await tick()
  assert.deepEqual(calls, [['a', true], ['b', true]])
})

test('a failed save settles as failed', async () => {
  const settled = []
  const set = createSync(async () => { throw new Error('offline') }, (key, failed) => settled.push(failed))
  set('me', true)
  await tick()
  assert.deepEqual(settled, [true])
})
