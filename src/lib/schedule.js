import { useEffect, useState } from 'react'
import { api } from '../data'
import { GAME } from './dates'
import { optionsOf } from './options'

let cached
// The weekly game day and time (from the server; the built-in default until it loads).
export function useSchedule() {
  const [schedule, setSchedule] = useState(cached ?? GAME)
  useEffect(() => {
    if (cached) return
    api.getSchedule().then((s) => {
      cached = s ?? GAME
      setSchedule(cached)
    }, () => {})
  }, [])
  return schedule
}

export function forgetSchedule() {
  cached = undefined
}

// The open group's options with every default filled in (rating mode, MVP, assists, …).
export function useOptions() {
  return optionsOf(useSchedule())
}
