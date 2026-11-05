import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../data'
import { createSync } from './sync.js'

// Loads data and reloads it when fn's inputs change. Keeps showing old data while reloading.
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: undefined, error: null })
  const fnRef = useRef(fn)
  fnRef.current = fn

  const reload = useCallback(() => {
    return fnRef.current().then(
      (data) => setState({ data, error: null }),
      (error) => setState((s) => ({ data: s.data, error })),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    reload()
  }, [reload])

  return { ...state, reload }
}

// Re-runs reload when another phone changes something, or when this phone wakes up.
export function useLiveUpdates(reload) {
  useEffect(() => {
    let timer
    const soon = () => {
      clearTimeout(timer)
      timer = setTimeout(reload, 150)
    }
    const unsubscribe = api.subscribe(soon)
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', reload)
    return () => {
      clearTimeout(timer)
      unsubscribe()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', reload)
    }
  }, [reload])
}

// Re-renders every `ms` while active (for the running clock).
export function useTicker(active, ms = 250) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((t) => t + 1), ms)
    return () => clearInterval(id)
  }, [active, ms])
}

// createSync as a hook: pending = { key: wanted value } to show over the loaded data.
export function usePendingToggles(send, reload) {
  const [pending, setPending] = useState({})
  const [failed, setFailed] = useState(false)
  const refs = useRef({ send, reload })
  refs.current = { send, reload }
  const round = useRef({}) // key -> taps so far, so an old round doesn't clear a newer tap
  const [set] = useState(() => {
    const sync = createSync(
      (key, want) => refs.current.send(key, want),
      async (key, bad) => {
        const at = round.current[key]
        try {
          await refs.current.reload()
        } catch {
          // shown from the old data; the next live update fixes it
        }
        if (round.current[key] !== at) return
        setFailed(bad)
        setPending((p) => {
          const { [key]: _, ...rest } = p
          return rest
        })
      },
    )
    return (key, want) => {
      round.current[key] = (round.current[key] ?? 0) + 1
      setFailed(false)
      setPending((p) => ({ ...p, [key]: want }))
      sync(key, want)
    }
  })
  return { pending, set, failed }
}
