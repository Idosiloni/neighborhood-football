import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../data'

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
