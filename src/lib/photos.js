import { useEffect, useState } from 'react'
import { api } from '../data'

// Player photos are not in the player list (that list is fetched again on every live change,
// and the photos are almost all of its size). A listed player has photo_v instead, which changes
// with his photo; the photo itself is downloaded once and kept on the phone under id + photo_v.
//
// player.photo, when present, wins: null = no photo (or just removed in a form), a data URL =
// a photo we already have (demo, join preview, a form). undefined = look it up by photo_v.

const memory = new Map() // 'id:v' → data URL
const waiting = new Map() // 'id:v' → { player, resolve, reject }[]
const inFlight = new Map() // 'id:v' → promise
let timer = null

const CACHE = 'player-photos-v1'
const keyOf = (p) => (p?.id && p.photo_v ? `${p.id}:${p.photo_v}` : null)
const cacheUrl = (key) => `${window.location.origin}/__photo/${key.replace(':', '/')}`

export const hasPhoto = (p) => (p?.photo !== undefined ? Boolean(p.photo) : Boolean(p?.photo_v))

async function fromCache(key) {
  try {
    const hit = await (await caches.open(CACHE)).match(cacheUrl(key))
    return hit ? await hit.text() : null
  } catch {
    return null // no Cache API (private mode, old browser): memory only
  }
}

async function toCache(key, photo) {
  try {
    await (await caches.open(CACHE)).put(cacheUrl(key), new Response(photo))
  } catch {
    // ignore: it is downloaded again next time
  }
}

// Asks the server for every photo requested in the last moment, 50 at a time.
async function flush() {
  timer = null
  const batch = [...waiting.entries()]
  waiting.clear()
  for (let i = 0; i < batch.length; i += 50) {
    const part = batch.slice(i, i + 50)
    let rows = []
    try {
      rows = await api.getPhotos(part.map(([key]) => key.split(':')[0]))
    } catch (err) {
      for (const [, callbacks] of part) callbacks.forEach((c) => c.reject(err))
      continue
    }
    const byId = new Map(rows.map((r) => [r.id, r]))
    for (const [key, callbacks] of part) {
      const row = byId.get(key.split(':')[0])
      const photo = row?.photo ?? null
      // A newer photo than the list knew about is fine too; keep it under the version we got.
      if (photo) {
        memory.set(key, photo)
        if (row.photo_v === key.split(':')[1]) toCache(key, photo)
      }
      callbacks.forEach((c) => c.resolve(photo))
    }
  }
}

function fetchPhoto(key) {
  return new Promise((resolve, reject) => {
    waiting.set(key, [...(waiting.get(key) ?? []), { resolve, reject }])
    timer ??= setTimeout(flush, 30)
  })
}

// The player's photo as a data URL, or null.
export async function loadPhoto(player) {
  if (player?.photo !== undefined) return player.photo
  const key = keyOf(player)
  if (!key) return null
  if (memory.has(key)) return memory.get(key)
  if (!inFlight.has(key)) {
    const p = (async () => {
      const cached = await fromCache(key)
      if (cached) {
        memory.set(key, cached)
        return cached
      }
      return fetchPhoto(key)
    })().finally(() => inFlight.delete(key))
    inFlight.set(key, p)
  }
  return inFlight.get(key)
}

// For screens: the photo now if we have it, and again once it has loaded.
export function usePhoto(player) {
  const inline = player?.photo
  const key = keyOf(player)
  const [loaded, setLoaded] = useState(() => (key ? memory.get(key) ?? null : null))

  useEffect(() => {
    if (inline !== undefined || !key) return
    let live = true
    setLoaded(memory.get(key) ?? null)
    loadPhoto({ id: player.id, photo_v: player.photo_v }).then((photo) => live && setLoaded(photo), () => {})
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inline, key])

  return inline !== undefined ? inline : key ? loaded : null
}
