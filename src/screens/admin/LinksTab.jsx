import { useEffect, useState } from 'react'
import { api } from '../../data'
import Avatar from '../../components/Avatar'
import Icon from '../../components/Icon'
import InviteCard from '../../components/InviteCard'
import { t } from '../../i18n'

const linkFor = (code) => `${window.location.origin}${window.location.pathname}#/v/${code}`

// The WhatsApp message with a player's personal link. group: the group's name, if it has one.
const messageFor = (name, code, group) => t('admin.links.message', { name, group: group || t('admin.links.theGroup'), link: linkFor(code) })

export default function LinksTab({ players, group }) {
  const [codes, setCodes] = useState()
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    api.listCodes().then(setCodes, (err) => setError(err.message || t('admin.links.unknownError')))
  }, [players])

  if (error) return <p className="err">{t('admin.links.loadFailed', { error })}</p>
  if (!codes) return <p className="center">{t('common.loading')}</p>

  const copy = async (p) => {
    await navigator.clipboard.writeText(messageFor(p.name, codes[p.id], group?.name))
    setCopied(p.id)
    setTimeout(() => setCopied(null), 1500)
  }

  const replace = async (p) => {
    if (!confirm(t('admin.links.confirmNew', { name: p.name }))) return
    const code = await api.newCode(p.id)
    setCodes({ ...codes, [p.id]: code })
  }

  return (
    <section className="stack">
      <InviteCard canRenew />
      <h2 className="section-title">{t('admin.links.title')}</h2>
      <p className="muted small">{t('admin.links.help')}</p>
      <ul className="player-list">
        {players.filter((p) => p.active).map((p) => (
          <li key={p.id} className="link-row">
            <Avatar player={p} size={40} />
            <span className="rank-name">
              {p.name}
              <small className="personal-code" dir="ltr">{codes[p.id] ?? t('admin.links.noCode')}</small>
            </span>
            <span className="link-actions">
              <a className="wa-soft" href={`https://wa.me/?text=${encodeURIComponent(messageFor(p.name, codes[p.id], group?.name))}`} target="_blank" rel="noreferrer">
                <Icon name="send" size={16} /> {t('admin.links.send')}
              </a>
              <button className="icon-btn flat" aria-label={t('admin.links.copyLabel', { name: p.name })} onClick={() => copy(p)}>
                <Icon name={copied === p.id ? 'check' : 'copy'} size={18} />
              </button>
              <button className="icon-btn flat" aria-label={t('admin.links.newLabel', { name: p.name })} onClick={() => replace(p)}>↻</button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
