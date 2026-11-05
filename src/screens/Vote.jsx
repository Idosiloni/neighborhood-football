import { useEffect, useState } from 'react'
import { api } from '../data'
import RankList from '../components/RankList'
import { setMyCode } from '../lib/identity'
import { optionsOf } from '../lib/options'
import { forgetSchedule } from '../lib/schedule'
import { go } from '../lib/router'
import PageHeader from '../components/PageHeader'
import { play } from '../lib/sound'
import { t } from '../i18n'

// Saved order first (minus anyone who left), then players they haven't ranked yet.
function startingOrder(players, voter) {
  const others = players.filter((p) => p.active && p.id !== voter.id)
  const byId = new Map(others.map((p) => [p.id, p]))
  const saved = (voter.ranking ?? []).map((id) => byId.get(id)).filter(Boolean)
  const rest = others.filter((p) => !saved.includes(p))
  return [...saved, ...rest]
}

export default function Vote({ code }) {
  const [voter, setVoter] = useState()
  const [order, setOrder] = useState([])
  const [start, setStart] = useState([]) // the order they were shown, to notice a save without ranking
  const [newOnes, setNewOnes] = useState(0)
  const [status, setStatus] = useState('idle') // idle | dirty | saving | saved | error

  useEffect(() => {
    // The code comes first: the player list is the one of their group, read with their code.
    api.getVoter(code)
      .then(async (v) => {
        if (!v) return setVoter(null)
        setMyCode(code, v.group) // this phone now belongs to them: they can mark attendance and run matches
        forgetSchedule()
        // The personal link ranks players only in groups that rate that way; other groups open
        // their welcome (which leads to rating by categories, or just home).
        const group = await api.getGroup().catch(() => null)
        if (group && optionsOf(group).rating !== 'peers') return go('/hello')
        const players = await api.listPlayers()
        setVoter(v)
        const list = startingOrder(players, v)
        setOrder(list)
        setStart(list.map((p) => p.id))
        if (v.ranking) setNewOnes(list.filter((p) => !v.ranking.includes(p.id)).length)
      })
      .catch(() => setStatus('error'))
  }, [code])

  if (status === 'error' && voter === undefined) return <Message text={t('common.offline')} />
  if (voter === undefined) return <Message text={t('common.loading')} />
  if (voter === null) return <Message text={t('stats.vote.notFound')} />

  const save = async () => {
    const untouched = order.length >= 3 && order.every((p, i) => p.id === start[i])
    if (untouched && !voter.ranking && !confirm(t('stats.vote.untouched'))) return
    setStatus('saving')
    try {
      const ids = order.map((p) => p.id)
      await api.submitBallot(code, ids)
      setVoter({ ...voter, ranking: ids })
      setStatus('saved')
      setNewOnes(0)
      play('win')
    } catch {
      setStatus('error')
    }
  }

  return (
    <main className="page vote">
      <PageHeader title={t('stats.vote.hi', { name: voter.name })} sub={t('stats.vote.sub')} back="#/me" />
      <p className="privacy">{t('stats.vote.privacy')}</p>
      {voter.ranking && (
        <p className="note">
          {t('stats.vote.savedNote')}
          {newOnes > 0 && ` ${t('stats.vote.newOnes', { count: newOnes })}`}
        </p>
      )}

      <div className="rank-ends">
        <span>{t('stats.vote.best')}</span>
        <RankList
          players={order}
          onChange={(next) => {
            setOrder(next)
            setStatus('dirty')
            play('pop')
          }}
        />
        <span>{t('stats.vote.worst')}</span>
      </div>

      <div className="save-bar">
        {status === 'saved' && <span className="ok">{t('stats.vote.saved')}</span>}
        {status === 'error' && <span className="err">{t('stats.vote.saveFailed')}</span>}
        <button className="btn big" onClick={save} disabled={status === 'saving' || order.length === 0}>
          {status === 'saving' ? t('common.saving') : voter.ranking ? t('stats.vote.update') : t('stats.vote.save')}
        </button>
      </div>
    </main>
  )
}

function Message({ text }) {
  return (
    <main className="page">
      <PageHeader title={t('stats.vote.title')} back="#/" />
      <p className="center big-text">{text}</p>
    </main>
  )
}
