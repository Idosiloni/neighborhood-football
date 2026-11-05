// Bigger text for whoever needs it, per phone ("אני" → text size). Everything in styles.css is
// sized in rem, so changing the root size scales the whole app.
const KEY = 'text-size'
export const TEXT_SIZES = ['normal', 'large', 'larger']

export function textSize() {
  try {
    const v = localStorage.getItem(KEY)
    return TEXT_SIZES.includes(v) ? v : 'normal'
  } catch {
    return 'normal'
  }
}

export function setTextSize(size) {
  try {
    if (size === 'normal') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, size)
  } catch {
    // private mode: this visit only
  }
  applyTextSize(size)
}

export function applyTextSize(size = textSize()) {
  if (typeof document === 'undefined') return
  if (size === 'normal') delete document.documentElement.dataset.text
  else document.documentElement.dataset.text = size
}
