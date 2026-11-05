import { useEffect, useState } from 'react'
import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { useMember } from '../lib/member'
import { useSchemaReady } from '../lib/schema'
import { TEAM } from '../lib/teamsMeta'
import { go } from '../lib/router'
import PageHeader from '../components/PageHeader'
import TeamBoard from '../components/TeamBoard'
import Avatar from '../components/Avatar'
import NeedsUpdate from '../components/NeedsUpdate'
import Icon from '../components/Icon'
import Lineup from '../components/Lineup'
import { writeManaging } from '../lib/managing'
import { t } from '../i18n'

export default function NextMatch({ matchId }) {
  const ready = useSchemaReady()
  return (
    <main className="page">
      <PageHeader title={t('match.nextMatch')} sub={t('match.nextSub')} back={`#/match/${matchId}`} />
      {ready === false ? <NeedsUpdate /> : ready ? <Body matchId={matchId} /> : <p className="center muted">{t('common.loading')}</p>}
    </main>
  )
}

function Body({ matchId }) {
  const member = useMember()
  const [groups, setGroups] = useState(null)
  const [view, setView] = useState('pitch')
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)

  const { data } = useLoad(async () => {
    const [match, players, suggestion] = await Promise.all([api.getMatch(matchId), api.listPlayers(), api.suggestRotation(matchId)])
    const later = (await api.listMatches(match.night_id)).find((m) => m.num > match.num)
    return { match, players, suggestion, later }
  }, [matchId])

  useEffect(() => {
    if (data?.suggestion) {
      const s = data.suggestion
      setGroups({ a: s.team_a, b: s.team_b, bench: s.bench })
    }
  }, [data])

  if (!data || !groups) return <p className="center muted">{t('match.computing')}</p>

  const { match, players, suggestion, later } = data
  const byId = Object.fromEntries(players.map((p) => [p.id, p]))
  const marks = Object.fromEntries(suggestion.entering.map((id) => [id, 'in']))
  // The team going off: the loser, or after a draw the one that has been on longer (the rotation decides).
  const loser = (suggestion.stays ?? match.winner) === 'a' ? 'b' : 'a'

  if (later) {
    return (
      <div className="card empty">
        <strong>{t('match.laterStarted', { num: later.num })}</strong>
        <a className="btn" href={`#/match/${later.id}`}>{t('match.toMatch', { num: later.num })}</a>
      </div>
    )
  }

  const start = async () => {
    setStarting(true)
    try {
      const m = await api.createMatch({ night_id: match.night_id, num: match.num + 1, team_a: groups.a, team_b: groups.b, bench: groups.bench })
      writeManaging(m.id) // whoever starts the match runs it
      go(`/match/${m.id}`)
    } catch {
      setError(t('match.newAlreadyStarted'))
      setStarting(false)
    }
  }

  return (
    <>
      <div className="swap-summary card">
        <div>
          <h3>{t('match.leaving', { team: TEAM[loser].name })}</h3>
          <div className="face-row">
            {suggestion.leaving.length === 0 && <span className="muted">{t('match.nobodyLeaving')}</span>}
            {suggestion.leaving.map((id) => byId[id] && (
              <span key={id} className="face out"><Avatar player={byId[id]} size={36} /><small>{byId[id].name}</small></span>
            ))}
          </div>
        </div>
        <Icon name="swap" size={26} className="swap-icon" />
        <div>
          <h3>{t('match.entering')}</h3>
          <div className="face-row">
            {suggestion.entering.length === 0 && <span className="muted">—</span>}
            {suggestion.entering.map((id) => byId[id] && (
              <span key={id} className="face in"><Avatar player={byId[id]} size={36} /><small>{byId[id].name}</small></span>
            ))}
          </div>
        </div>
      </div>
      <p className="muted small">{t('match.rotationNote')}</p>

      <div className="view-toggle">
        <button className={view === 'pitch' ? 'on' : ''} onClick={() => setView('pitch')}>{t('match.viewPitch')}</button>
        <button className={view === 'edit' ? 'on' : ''} onClick={() => setView('edit')}>{t('match.viewEdit')}</button>
      </div>
      {view === 'pitch' ? (
        <Lineup teamA={groups.a} teamB={groups.b} byId={byId} />
      ) : (
        <TeamBoard groups={groups} playersById={byId} onChange={setGroups} editable={member} marks={marks} />
      )}

      {error && <p className="err">{error}</p>}
      {member && (
        <button className="btn big" onClick={start} disabled={starting}>
          <Icon name="play" size={20} /> {t('match.startNum', { num: match.num + 1 })}
        </button>
      )}
    </>
  )
}
