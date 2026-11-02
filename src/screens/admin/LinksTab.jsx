import { useEffect, useState } from 'react'
import { api } from '../../data'
import Avatar from '../../components/Avatar'
import Icon from '../../components/Icon'
import InviteCard from '../../components/InviteCard'

const linkFor = (code) => `${window.location.origin}${window.location.pathname}#/v/${code}`

const messageFor = (name, code, group) =>
  `היי ${name}! ⚽ זה הקישור האישי שלך ל${group}.\n` +
  `הקישור הוא רק שלך, אל תעביר אותו לאף אחד.\n${linkFor(code)}`

export default function LinksTab({ players, group }) {
  const [codes, setCodes] = useState()
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    api.listCodes().then(setCodes, (err) => setError(err.message || 'unknown error'))
  }, [players])

  if (error) return <p className="err">לא הצלחתי לטעון את הקודים האישיים: {error}</p>
  if (!codes) return <p className="center">טוען…</p>

  const copy = async (p) => {
    await navigator.clipboard.writeText(messageFor(p.name, codes[p.id], group?.name ?? 'הקבוצה'))
    setCopied(p.id)
    setTimeout(() => setCopied(null), 1500)
  }

  const replace = async (p) => {
    if (!confirm(`ליצור ל${p.name} קוד חדש? הקישור הישן יפסיק לעבוד. הדירוג שלו נשמר.`)) return
    const code = await api.newCode(p.id)
    setCodes({ ...codes, [p.id]: code })
  }

  return (
    <section className="stack">
      <InviteCard canRenew />
      <h2 className="section-title">קישורים אישיים</h2>
      <p className="muted small">שולחים לכל שחקן בהודעה פרטית: מי שמחזיק בקישור מדרג בשמו. דלף? ↻ יוצר קוד חדש.</p>
      <ul className="player-list">
        {players.filter((p) => p.active).map((p) => (
          <li key={p.id} className="link-row">
            <Avatar player={p} size={40} />
            <span className="rank-name">
              {p.name}
              <small className="personal-code" dir="ltr">{codes[p.id] ?? 'אין קוד'}</small>
            </span>
            <span className="link-actions">
              <a className="wa-soft" href={`https://wa.me/?text=${encodeURIComponent(messageFor(p.name, codes[p.id], group?.name ?? 'הקבוצה'))}`} target="_blank" rel="noreferrer">
                <Icon name="send" size={16} /> שלח
              </a>
              <button className="icon-btn flat" aria-label={`העתק את הקישור של ${p.name}`} onClick={() => copy(p)}>
                <Icon name={copied === p.id ? 'check' : 'copy'} size={18} />
              </button>
              <button className="icon-btn flat" aria-label={`קוד חדש ל${p.name}`} onClick={() => replace(p)}>↻</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
