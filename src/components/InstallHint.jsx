import { useEffect, useState } from 'react'
import { t } from '../i18n'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

// WhatsApp opens links in its own browser, where "install" is not possible,
// so we tell people how to get to a real browser first.
// Closed once with ×, it stays closed on this phone.
const KEY = 'install-hint-closed'
const wasClosed = () => {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export default function InstallHint() {
  const [prompt, setPrompt] = useState(null)
  const [closed, setClosed] = useState(wasClosed)

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (isStandalone() || closed) return null
  const close = () => {
    setClosed(true)
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      // private mode: closed until the page reloads
    }
  }

  if (prompt) {
    return (
      <button className="btn install" onClick={() => prompt.prompt().then(() => setPrompt(null))}>
        {t('onboarding.install.button')}
      </button>
    )
  }

  return (
    <div className="card hint">
      <button type="button" className="hint-close" onClick={close} aria-label={t('common.close')}>×</button>
      <strong>{t('onboarding.install.title')}</strong>
      <p>{isIos() ? t('onboarding.install.ios') : t('onboarding.install.android')}</p>
    </div>
  )
}
