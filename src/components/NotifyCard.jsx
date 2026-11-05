import { useEffect, useState } from 'react'
import { pushOn, pushState, turnPushOff, turnPushOn } from '../lib/push'
import { t } from '../i18n'

const ASKED = 'push-ask-closed'
const asked = () => {
  try {
    return localStorage.getItem(ASKED) === '1'
  } catch {
    return true
  }
}

// Notifications for the open group on this phone, on or off (in "Me").
// compact: the one-time offer on the home screen, gone once answered or closed.
export default function NotifyCard({ compact = false }) {
  const state = pushState()
  const [on, setOn] = useState(null) // null: checking
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [closed, setClosed] = useState(compact && asked())

  useEffect(() => {
    if (state !== 'ok' || closed) return
    pushOn().then(setOn, () => setOn(false))
  }, [state, closed])

  const close = () => {
    setClosed(true)
    try {
      localStorage.setItem(ASKED, '1')
    } catch {
      // private mode
    }
  }

  const toggle = async () => {
    setBusy(true)
    setError('')
    try {
      if (on) {
        await turnPushOff()
        setOn(false)
      } else {
        const ok = await turnPushOn()
        setOn(ok)
        if (!ok) setError(Notification.permission === 'denied' ? t('home.push.blocked') : t('common.failed'))
        else if (compact) close()
      }
    } catch {
      setError(t('common.failed'))
    }
    setBusy(false)
  }

  if (compact) {
    if (closed || state !== 'ok' || on !== false) return null
    return (
      <section className="card notify-ask">
        <button className="hint-close" onClick={close} aria-label={t('common.close')}>×</button>
        <strong>🔔 {t('home.push.askTitle')}</strong>
        <p className="muted small">{t('home.push.askText')}</p>
        <button className="btn small" onClick={toggle} disabled={busy}>{t('home.push.turnOn')}</button>
        {error && <p className="err small">{error}</p>}
      </section>
    )
  }

  if (state === 'none') return null
  return (
    <div className="card stack">
      <strong>🔔 {t('home.push.title')}</strong>
      <p className="muted small">{t('home.push.text')}</p>
      {state === 'install' && <p className="note small">{t('home.push.install')}</p>}
      {state === 'blocked' && <p className="note small">{t('home.push.blocked')}</p>}
      {state === 'ok' && (
        <label className="check">
          <input type="checkbox" checked={Boolean(on)} disabled={busy || on === null} onChange={toggle} />
          {t('home.push.toggle')}
        </label>
      )}
      {error && <p className="err small">{error}</p>}
    </div>
  )
}
