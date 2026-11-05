// The start screen drawn by index.html (#splash): fades out once the app has something to show.
export function hideSplash() {
  const el = document.getElementById('splash')
  if (!el || el.classList.contains('gone')) return
  el.classList.add('gone')
  setTimeout(() => el.remove(), 400)
}
