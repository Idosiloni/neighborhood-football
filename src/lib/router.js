import { useEffect, useState } from 'react'

// Tiny hash router: "#/v/abc123" → ['v', 'abc123']
function read() {
  return window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

export function useRoute() {
  const [parts, setParts] = useState(read)
  useEffect(() => {
    // A new screen starts at its top, not where the last one was scrolled to.
    const onChange = () => {
      setParts(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return parts
}

export function go(path) {
  window.location.hash = path
}
