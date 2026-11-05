import { useEffect, useState } from 'react'
import { t } from '../i18n'

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
        {t('onboarding.install.button')}
      </button>
    )
  }

  return (
    <div className="card hint">
      <strong>{t('onboarding.install.title')}</strong>
      <p>{isIos() ? t('onboarding.install.ios') : t('onboarding.install.android')}</p>
    </div>
  )
}
