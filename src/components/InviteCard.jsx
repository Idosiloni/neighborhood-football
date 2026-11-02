import { useEffect, useState } from 'react'
import { api } from '../data'

export const joinMessage = (code, group = 'הקבוצה') =>
  `⚽ מצטרפים ל${group} באפליקציה!\n` +
  `נכנסים, בוחרים את השם שלכם מהרשימה (או נרשמים), מצלמים סלפי לכרטיס ומדרגים:\n` +
  `${window.location.origin}${window.location.pathname}#/join/${code}\n` +
  `(קוד הצטרפות: ${code})`

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
  if (error || group === null) return canRenew ? <p className="err small">לא הצלחתי לטעון את קישור ההצטרפות: {error || 'אין קבוצה'}</p> : null
  if (!code) return null
  const message = joinMessage(code, group.name)

  return (
    <div className="card stack join-card">
      <strong>{canRenew ? '🔗 קישור הצטרפות לקבוצה' : '📨 הזמן חברים'}</strong>
      <div className="join-code">
        <span>קוד הצטרפות</span>
        <b dir="ltr">{code}</b>
      </div>
      <p className="join-url" dir="ltr">{`${window.location.host}/#/join/${code}`}</p>
      <p className="muted small">
        {canRenew
          ? 'קישור אחד לכל הקבוצה. מי שכבר ברשימה בוחר את השם שלו, ומי שלא נרשם לבד. שם שמישהו כבר בחר נעלם מהרשימה.'
          : 'שלח לחברים שעוד לא באפליקציה. כל אחד בוחר את השם שלו מהרשימה, או נרשם.'}
      </p>
      <div className="row">
        <a className="btn small wa" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">שלח בוואטסאפ</a>
        <button className="btn small ghost" onClick={async () => {
          await navigator.clipboard.writeText(message)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}>{copied ? '✓ הועתק' : 'העתק'}</button>
        {canRenew && (
          <button className="btn small ghost" onClick={async () => {
            if (confirm('ליצור קישור הצטרפות חדש? הישן יפסיק לעבוד.')) setGroup({ ...group, join_code: await api.newJoinCode() })
          }}>↻ חדש</button>
        )}
      </div>
    </div>
  )
}
