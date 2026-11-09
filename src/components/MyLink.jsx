import { useState } from 'react'
import { t } from '../i18n'

// The player's own link: how he gets back in from another phone (and stays admin).
export default function MyLink({ code, admin, onSaved }) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}${window.location.pathname}#/v/${code}`
  return (
    <div className="card stack">
      <strong>{t('onboarding.myLink.title')}</strong>
      <p className="muted small">
        {admin
          ? t('onboarding.myLink.adminHint')
          : t('onboarding.myLink.hint')}
      </p>
      <button className="btn small ghost" onClick={async () => {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        onSaved?.()
        setTimeout(() => setCopied(false), 1500)
      }}>{copied ? t('onboarding.myLink.copied') : t('onboarding.myLink.copy')}</button>
      {/* WhatsApp's "message yourself" or any chat keeps it findable later. */}
      <a className="btn small ghost" href={`https://wa.me/?text=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" onClick={() => onSaved?.()}>
        {t('onboarding.myLink.send')}
      </a>
    </div>
  )
}
