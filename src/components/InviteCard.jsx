import { useEffect, useState } from 'react'
import { api } from '../data'
import { t } from '../i18n'

// The invite message for WhatsApp / the share menu.
export const joinMessage = (code, group) =>
  t('onboarding.invite.message', {
    group: group || t('onboarding.invite.defaultGroup'),
    link: `${window.location.origin}${window.location.pathname}#/join/${code}`,
    code,
  })

// The group join link with its code. Every player of the group sees it (to invite friends);
// only an admin can replace the code.
export default function InviteCard({ canRenew = false }) {
  const [group, setGroup] = useState()
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const code = group?.join_code

  useEffect(() => {
    api.getGroup().then(setGroup, (err) => setError(err.message || 'unknown error'))
  }, [])

  // Players who can't see it (not registered, or old server) simply don't get the card.
  if (error || group === null) return canRenew ? <p className="err small">{t('onboarding.invite.loadError', { error: error || t('onboarding.invite.noGroup') })}</p> : null
  if (!code) return null
  const message = joinMessage(code, group.name)

  return (
    <div className="card stack join-card">
      <strong>{canRenew ? t('onboarding.invite.adminTitle') : t('onboarding.invite.title')}</strong>
      <div className="join-code">
        <span>{t('onboarding.invite.code')}</span>
        <b dir="ltr">{code}</b>
      </div>
      <p className="join-url" dir="ltr">{`${window.location.host}/#/join/${code}`}</p>
      <p className="muted small">
        {canRenew
          ? t('onboarding.invite.adminHint')
          : t('onboarding.invite.hint')}
      </p>
      <div className="row">
        <a className="btn small wa" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">{t('onboarding.invite.whatsapp')}</a>
        <button className="btn small ghost" onClick={async () => {
          await navigator.clipboard.writeText(message)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}>{copied ? t('onboarding.invite.copied') : t('onboarding.invite.copy')}</button>
        {canRenew && (
          <button className="btn small ghost" onClick={async () => {
            if (confirm(t('onboarding.invite.renewConfirm'))) setGroup({ ...group, join_code: await api.newJoinCode() })
          }}>{t('onboarding.invite.renew')}</button>
        )}
      </div>
    </div>
  )
}
