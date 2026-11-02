import { useEffect, useState } from 'react'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

// WhatsApp opens links in its own browser, where "install" is not possible,
// so we tell people how to get to a real browser first.
export default function InstallHint() {
  const [prompt, setPrompt] = useState(null)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (isStandalone()) return null

  if (prompt) {
    return (
      <button className="btn install" onClick={() => prompt.prompt().then(() => setPrompt(null))}>
        📲 התקן את האפליקציה בטלפון
      </button>
    )
  }

  return (
    <div className="card hint">
      <strong>📲 להתקנה על המסך הראשי</strong>
      {isIos() ? (
        <p>פתח את הקישור ב-Safari (אם נפתח מתוך וואטסאפ: לחץ על ⋯ ואז "פתח ב-Safari"), לחץ על כפתור השיתוף ⬆️ ובחר "הוסף למסך הבית".</p>
      ) : (
        <p>פתח את הקישור ב-Chrome (אם נפתח מתוך וואטסאפ: לחץ על ⋮ ואז "פתח ב-Chrome"), לחץ על ⋮ ובחר "התקן אפליקציה" או "הוסף למסך הבית".</p>
      )}
    </div>
  )
}
