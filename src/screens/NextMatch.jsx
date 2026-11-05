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
import Loading from '../components/Loading'

export default function NextMatch({ matchId }) {
  const ready = useSchemaReady()
  return (
    <main className="page">
      <PageHeader title={t('match.nextMatch')} back={`#/match/${matchId}`} />
      {ready === false ? <NeedsUpdate /> : ready ? <Body matchId={matchId} /> : <Loading />}
    </main>
  )
}

function Body({ matchId }) {
  const member = useMember()
  const [groups, setGroups] = useState(null)
  const [view, setView] = useState('pitch')
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(false)
  const [mode, setMode] = useState(null) // rotate | same | shuffle
  const [shuffling, setShuffling] = useState(false)

  const { data } = useLoad(async () => {
    const [match, players, suggestion] = await Promise.all([api.getMatch(matchId), api.listPlayers(), api.suggestRotation(matchId)])
    const later = (await api.listMatches(match.night_id)).find((m) => m.num > match.num)
    return { match, players, suggestion, later }
  }, [matchId])

  // Everyone played last time and nobody new is waiting: the same teams again, by default.
  // Otherwise the usual rotation (so late arrivals get in). Either way the others are one tap away.
  useEffect(() => {
    if (!data?.suggestion || mode) return
    const s = data.suggestion
    const played = new Set([...data.match.team_a, ...data.match.team_b])
    const newcomers = [...s.team_a, ...s.team_b, ...s.bench].some((id) => !played.has(id))
    pick((data.match.bench ?? []).length === 0 && !newcomers ? 'same' : 'rotate')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  if (!data || !groups) return <Loading text={t('match.computing')} />

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

  function pick(next) {
    const s = data.suggestion
    setMode(next)
    setError('')
    if (next === 'rotate') return setGroups({ a: s.team_a, b: s.team_b, bench: s.bench })
    // Everyone here tonight (the rotation's answer has them all).
    const present = new Set([...s.team_a, ...s.team_b, ...s.bench])
    const a = data.match.team_a.filter((id) => present.has(id))
    const b = data.match.team_b.filter((id) => present.has(id))
    const bench = [...present].filter((id) => !a.includes(id) && !b.includes(id))
    if (next === 'same') return setGroups({ a, b, bench })
    // A new balanced split of the same players; newcomers keep waiting.
    setShuffling(true)
    api.makeTeams(data.match.night_id, bench).then(
      (x) => setGroups({ a: x.a, b: x.b, bench }),
      () => setError(t('match.splitFailed')),
    ).finally(() => setShuffling(false))
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
      <div className="field">
        <span className="muted small">{t('match.nextMode.title')}</span>
        <div className="view-toggle three">
          {['rotate', 'same', 'shuffle'].map((x) => (
            <button key={x} className={mode === x ? 'on' : ''} aria-pressed={mode === x} disabled={shuffling} onClick={() => pick(x)}>
              {t(`match.nextMode.${x}`)}
            </button>
          ))}
        </div>
        <small className="muted">{shuffling ? t('match.nextMode.shuffling') : t(`match.nextMode.${mode}Hint`)}</small>
      </div>

      {mode === 'rotate' && <div className="swap-summary card">
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
      </div>}
      {mode === 'rotate' && <p className="muted small">{t('match.rotationNote')}</p>}

      <div className="view-toggle">
        <button className={view === 'pitch' ? 'on' : ''} onClick={() => setView('pitch')}>{t('match.viewPitch')}</button>
        <button className={view === 'edit' ? 'on' : ''} onClick={() => setView('edit')}>{t('match.viewEdit')}</button>
      </div>
      {view === 'pitch' ? (
        <Lineup teamA={groups.a} teamB={groups.b} byId={byId} />
      ) : (
        <TeamBoard groups={groups} playersById={byId} onChange={setGroups} editable={member} marks={mode === 'rotate' ? marks : {}} />
      )}

      {error && <p className="err">{error}</p>}
      {member && (
        <button className="btn big" onClick={start} disabled={starting || shuffling}>
          <Icon name="play" size={20} /> {t('match.startNum', { num: match.num + 1 })}
        </button>
      )}
    </>
  )
}
