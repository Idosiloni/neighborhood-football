// Which match this phone is running (timer + goals). Survives refresh.
const KEY = 'managing-match'

export function readManaging() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function writeManaging(id) {
  try {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  } catch {
    // fine: controls just won't survive a refresh
  }
}
