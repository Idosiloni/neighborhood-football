import { useState } from 'react'

// The player's own link: how he gets back in from another phone (and stays admin).
export default function MyLink({ code, admin }) {
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}${window.location.pathname}#/v/${code}`
  return (
    <div className="card stack">
      <strong>🔑 הקישור האישי שלך</strong>
      <p className="muted small">
        {admin
          ? 'שמור אותו במקום בטוח (למשל שלח אותו לעצמך). ככה נכנסים מטלפון חדש ונשארים מנהל. אל תעביר אותו לאף אחד.'
          : 'ככה נכנסים מטלפון אחר. אל תעביר אותו לאף אחד: מי שמחזיק בו מדרג בשמך.'}
      </p>
      <button className="btn small ghost" onClick={async () => {
        await navigator.clipboard.writeText(link)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}>{copied ? '✓ הועתק' : 'העתק את הקישור שלי'}</button>
    </div>
  )
}
