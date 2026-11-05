// Asking to join a group found in "Find a group": this phone's secret token (the only way to see
// the answer and, once let in, the personal code). Kept on the phone; lost = ask again.
const KEY = 'join-token'

export function requestToken() {
  try {
    let tok = localStorage.getItem(KEY)
    if (!tok) {
      tok = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('')
      localStorage.setItem(KEY, tok)
    }
    return tok
  } catch {
    return null // private mode: can't wait for an answer
  }
}

export function hasRequests() {
  try {
    return Boolean(localStorage.getItem(KEY))
  } catch {
    return false
  }
}
