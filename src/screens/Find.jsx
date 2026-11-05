import { useEffect, useState } from 'react'
import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { myGroups, setMyCode } from '../lib/identity'
import { requestToken, hasRequests } from '../lib/requests'
import { gameLabel, nextGameDay } from '../lib/dates'
import { forgetSchedule } from '../lib/schedule'
import { go } from '../lib/router'
import PageHeader from '../components/PageHeader'
import Sheet from '../components/Sheet'
import Loading from '../components/Loading'
import { t } from '../i18n'

const ERRORS = { 'already in': 'alreadyIn', declined: 'declined', 'too many requests': 'tooMany', 'not listed': 'notListed', 'name required': 'nameRequired' }
const friendly = (err) => t(`onboarding.find.errors.${Object.entries(ERRORS).find(([k]) => err?.message?.includes(k))?.[1] ?? 'failed'}`)

// Find a group by city or pitch (only groups whose admin listed them) and ask to join.
// The admin lets you in; this screen then shows "you're in" with the way into the group.
export default function Find() {
  const [query, setQuery] = useState('')
  const [asked, setAsked] = useState(query)
  const [open, setOpen] = useState(null) // the group in the sheet
  const mine = myGroups().map((g) => g.id)

  const { data: groups, error } = useLoad(() => api.findGroups(asked), [asked])
  const { data: requests, reload: reloadRequests } = useLoad(async () => (hasRequests() ? api.myRequests(requestToken()) : []), [])

  // Waiting for an answer: look again every 20 seconds while this screen is open.
  const waiting = requests?.some((r) => r.status === 'pending')
  useEffect(() => {
    if (!waiting) return
    const id = setInterval(reloadRequests, 20000)
    return () => clearInterval(id)
  }, [waiting, reloadRequests])

  const enter = (r) => {
    setMyCode(r.code, { id: r.group_id, name: r.group_name })
    forgetSchedule()
    go('/hello')
  }
  const statusOf = (id) => requests?.find((r) => r.group_id === id)

  return (
    <main className="page">
      <PageHeader title={t('onboarding.find.title')} sub={t('onboarding.find.sub')} back="#/" />

      {requests?.length > 0 && (
        <section className="stack">
          <h2 className="section-title">{t('onboarding.find.myRequests')}</h2>
          {requests.map((r) => (
            <div key={r.id} className={`card request-row ${r.status}`}>
              <span className="stack tight">
                <strong>{r.group_name}</strong>
                <span className="muted small">{t(`onboarding.find.status.${r.status}`)}</span>
              </span>
              {r.status === 'approved' && r.code && !mine.includes(r.group_id) && <button className="btn small" onClick={() => enter(r)}>{t('onboarding.find.enter')}</button>}
              {r.status === 'pending' && (
                <button className="link-btn" onClick={async () => { await api.cancelRequest(requestToken(), r.id).catch(() => {}); reloadRequests() }}>
                  {t('onboarding.find.cancel')}
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      <form className="find-search" onSubmit={(e) => { e.preventDefault(); setAsked(query.trim()) }}>
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('onboarding.find.placeholder')}
          aria-label={t('onboarding.find.placeholder')} enterKeyHint="search" />
        <button className="btn">{t('onboarding.find.search')}</button>
      </form>

      {error && !groups && <p className="err">{t('common.offline')}</p>}
      {!groups && !error && <Loading />}
      {groups?.length === 0 && (
        <div className="card empty">
          <div className="empty-emoji">🔎</div>
          <strong>{asked ? t('onboarding.find.noneHere') : t('onboarding.find.noneYet')}</strong>
          <p className="muted">{t('onboarding.find.noneText')}</p>
        </div>
      )}
      {groups?.map((g) => (
        <button key={g.id} className="card find-group" onClick={() => setOpen(g)}>
          <span className="find-top">
            <strong>{g.name}</strong>
            {g.looking && <span className="tag looking">{t('onboarding.find.looking')}</span>}
          </span>
          <span className="muted small">{[g.city, g.venue].filter(Boolean).join(' · ')}</span>
          <span className="small">{gameLabel(nextGameDay(new Date(), g), g)} · {t('onboarding.find.size', { n: g.team_size })} · {t('onboarding.find.players', { count: g.players })}</span>
          {g.about && <span className="muted small">{g.about}</span>}
          {mine.includes(g.id) ? <span className="tag">{t('onboarding.find.yours')}</span> : statusOf(g.id) && <span className="tag">{t(`onboarding.find.status.${statusOf(g.id).status}`)}</span>}
        </button>
      ))}

      {open && <RequestSheet group={open} onClose={() => setOpen(null)} onSent={() => { setOpen(null); reloadRequests() }} />}
    </main>
  )
}

function RequestSheet({ group, onClose, onSent }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const token = requestToken()

  const send = async (e) => {
    e.preventDefault()
    if (!token) return setError(t('onboarding.find.errors.storage'))
    setBusy(true)
    setError('')
    try {
      await api.requestJoin(group.id, token, name.trim(), note.trim())
      onSent()
    } catch (err) {
      setError(friendly(err))
      setBusy(false)
    }
  }

  return (
    <Sheet title={group.name} onClose={onClose}>
      <form className="stack" onSubmit={send}>
        <p className="muted small">{t('onboarding.find.requestText')}</p>
        <label className="field">
          <span>{t('onboarding.find.name')}</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value.slice(0, 30))} required autoComplete="nickname" />
        </label>
        <label className="field">
          <span>{t('onboarding.find.note')}</span>
          <textarea className="input" rows={3} value={note} onChange={(e) => setNote(e.target.value.slice(0, 140))} placeholder={t('onboarding.find.notePlaceholder')} />
        </label>
        {error && <p className="err">{error}</p>}
        <button className="btn big" disabled={busy || !name.trim()}>{t('onboarding.find.send')}</button>
      </form>
    </Sheet>
  )
}
