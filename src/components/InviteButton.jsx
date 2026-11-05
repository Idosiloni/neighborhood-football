import { useEffect, useState } from 'react'
import { api } from '../data'
import { joinMessage } from './InviteCard'
import { t } from '../i18n'

// One tap to invite a friend: opens the phone's share menu (or WhatsApp) with the join link.
// Only shows for players who may see the join code.
export default function InviteButton() {
  const [group, setGroup] = useState()

  useEffect(() => {
    api.getGroup().then(setGroup, () => setGroup(null))
  }, [])

  const code = group?.join_code
  if (!code) return null

  const share = async () => {
    const text = joinMessage(code, group.name)
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch (err) {
        if (err.name === 'AbortError') return
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  return (
    <button className="btn ghost invite-btn" onClick={share}>
      {t('onboarding.invite.button')} <span className="invite-code" dir="ltr">{code}</span>
    </button>
  )
}
