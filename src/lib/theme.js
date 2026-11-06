// Light or dark look, per phone ("אני" → display). 'auto' follows the phone's setting, live.
// The chosen look is set on <html data-theme>, and styles.css has the dark colors for it.
const KEY = 'theme'
export const THEMES = ['auto', 'light', 'dark']

export function theme() {
  try {
    const v = localStorage.getItem(KEY)
    return THEMES.includes(v) ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export function setTheme(value) {
  try {
    if (value === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, value)
  } catch {
    // private mode: this visit only
  }
  applyTheme(value)
}

let following // the phone-setting listener, while 'auto'

export function applyTheme(value = theme()) {
  if (typeof document === 'undefined') return
  const media = globalThis.matchMedia?.('(prefers-color-scheme: dark)')
  const set = () => {
    document.documentElement.dataset.theme = value === 'auto' ? (media?.matches ? 'dark' : 'light') : value
  }
  set()
  if (following) media?.removeEventListener?.('change', following)
  following = value === 'auto' ? set : null
  if (following) media?.addEventListener?.('change', following)
}
