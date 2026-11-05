import { useEffect, useState } from 'react'
import { api } from '../data'
import { GAME } from './dates'
import { optionsOf } from './options'
import { getMyCode } from './identity'

// Kept per group (by the open code): opening another group's personal link without a reload
// must not keep showing the previous group's options.
let cached // { code, schedule }
const fresh = () => (cached && cached.code === getMyCode() ? cached.schedule : null)

// The weekly game day and time (from the server; the built-in default until it loads).
export function useSchedule() {
  const [schedule, setSchedule] = useState(() => fresh() ?? GAME)
  useEffect(() => {
    if (fresh()) return setSchedule(fresh())
    const code = getMyCode()
    api.getSchedule().then((s) => {
      cached = { code, schedule: s ?? GAME }
      if (code === getMyCode()) setSchedule(cached.schedule)
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
