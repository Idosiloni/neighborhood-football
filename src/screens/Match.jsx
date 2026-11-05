import { useEffect, useRef, useState } from 'react'
import { api } from '../data'
import { useLoad, useLiveUpdates, useTicker } from '../lib/hooks'
import { useMember } from '../lib/member'
import { useSchemaReady } from '../lib/schema'
import { breakLeft, extraMs, formatClock, nextState, periodOf, phaseStart, remaining, rulesOf, scoreOf, shownElapsed, startFields, winGoals } from '../lib/clock'
import { TEAM } from '../lib/teamsMeta'
import { go } from '../lib/router'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import Sheet from '../components/Sheet'
import Icon from '../components/Icon'
import NeedsUpdate from '../components/NeedsUpdate'
import MvpVote from '../components/MvpVote'
import Lineup from '../components/Lineup'
import { readManaging, writeManaging } from '../lib/managing'
import { celebrate } from '../components/Celebration'
import { play } from '../lib/sound'
import { t } from '../i18n'

// Short beep + vibration when the match changes phase or ends.
function signal() {
  try {
    navigator.vibrate?.([200, 100, 200])
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
  } catch {
    // no sound on this phone
  }
}

// Keeps the screen on while the manager runs the clock.
function useWakeLock(on) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return
    let lock = null
    let cancelled = false
    const request = () =>
      navigator.wakeLock.request('screen').then((l) => {
        if (cancelled) l.release()
        else lock = l
      }, () => {})
    const onVisible = () => document.visibilityState === 'visible' && request()
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      lock?.release()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [on])
}

export default function Match({ id }) {
  const ready = useSchemaReady()
  if (ready === false) {
    return (
      <main className="page">
        <PageHeader title={t('match.title')} back="#/tonight" />
        <NeedsUpdate />
      </main>
    )
  }
  return ready ? <MatchBody id={id} /> : <main className="page"><p className="center muted">{t('common.loading')}</p></main>
}

function MatchBody({ id }) {
  const member = useMember()
  const { data: admin } = useLoad(() => api.getAdmin().catch(() => false), [])
  const [managing, setManaging] = useState(() => readManaging() === id)
  const [m, setM] = useState(null)
  const [goals, setGoals] = useState([])
  const [sheet, setSheet] = useState(null) // { kind: 'goal', team, scorer? } | { kind: 'menu' }
  const saving = useRef(false)

  const { data, error, reload } = useLoad(async () => {
    const [match, goals, players] = await Promise.all([api.getMatch(id), api.listGoals(id), api.listPlayers()])
    return { match, goals, players }
  }, [id])
  useLiveUpdates(reload)

  useEffect(() => {
    if (!data) return
    setM(data.match)
    setGoals([...data.goals].sort((x, y) => x.created_at.localeCompare(y.created_at)))
  }, [data])

  // Goals and whistles that happen while this screen is open, on every phone watching.
  // What was already there when it opened is never celebrated again.
  const seen = useRef(null) // { goals, status, running, phase }
  useEffect(() => {
    if (!m || !data) return
    const now = { goals: goals.length, status: m.status, running: Boolean(m.running_since), phase: m.phase }
    const was = seen.current
    seen.current = now
    if (!was) return
    const players = Object.fromEntries(data.players.map((p) => [p.id, p]))
    const goal = now.goals > was.goals
    const won = now.status === 'finished' && was.status === 'live'
    if (goal) {
      const g = goals.at(-1)
      celebrate({ kind: 'goal', team: g.team, player: players[g.scorer], score: scoreOf(goals) })
    }
    if (won) {
      celebrate({ kind: 'win', team: m.winner, score: scoreOf(goals) }) // queued after the winning goal
    } else if (!goal && now.running && !was.running) {
      play(m.clock_ms === 0 ? 'kickoff' : 'whistle')
    } else if (!goal && now.phase !== was.phase) {
      play('whistle')
    }
  }, [m, goals, data])

  const control = managing && member && m?.status === 'live'
  const onBreak = m?.phase === 'break'
  useTicker(Boolean(m?.running_since) || onBreak)
  useWakeLock(control && (Boolean(m?.running_since) || onBreak))
  // The end of half-time: a whistle on the manager's phone (the manager starts the next half).
  const breakDone = onBreak && breakLeft(m) <= 0
  useEffect(() => {
    if (control && breakDone) signal()
  }, [control, breakDone])

  const update = async (fields, opts) => {
    setM((cur) => ({ ...cur, ...fields }))
    try {
      await api.updateMatch(id, fields, opts)
    } finally {
      reload()
    }
  }

  // The manager's phone moves the match forward: end at the goal limit / time, extra time, golden goal.
  useEffect(() => {
    if (!control || saving.current || !m) return
    const next = nextState(m, goals)
    if (!next) return
    saving.current = true
    signal()
    update(next, { onlyLive: true }).finally(() => (saving.current = false))
  })

  if (error && !data) return <main className="page"><p className="err center">{t('common.offline')}</p></main>
  if (!data || !m) {
    return (
      <main className="page">
        <PageHeader title={t('match.title')} back="#/tonight" />
        <p className="center muted">{data && !data.match ? t('match.notFound') : t('common.loading')}</p>
      </main>
    )
  }

  const byId = Object.fromEntries(data.players.map((p) => [p.id, p]))
  const score = scoreOf(goals)
  const running = Boolean(m.running_since)
  const left = remaining(m)
  const finished = m.status === 'finished'
  const finalSeconds = running && left !== null && left <= 10_000
  // Clock stopped exactly where extra time / golden goal begins: waiting for the manager to start it.
  const waitingPhase = !finished && !running && (m.phase === 'extra' || m.phase === 'golden') && m.clock_ms === phaseStart(m)
  const { periods } = rulesOf(m)
  // "מחצית 2" / "Half 2" in a long game; nothing for a short match.
  const partName = (num) => (periods > 1 ? t(`match.periodName.${Math.min(periods, 4)}`, { num }) : null)
  const brk = onBreak ? breakLeft(m) : null
  const penalties = !finished && m.phase === 'penalties'
  const phaseLabel = finished
    ? t('match.finished')
    : m.phase === 'regular' && periods > 1
      ? partName(periodOf(m))
      : t(`match.phase.${m.phase}`)

  const now = () => new Date().toISOString()
  const start = () => update(startFields(m))
  const pause = () => update({ clock_ms: shownElapsed(m), running_since: null })

  const addGoal = async (team, scorer, assist) => {
    setSheet(null)
    const goal = { match_id: id, team, scorer, assist, at_ms: shownElapsed(m) }
    setGoals((g) => [...g, { ...goal, id: `tmp-${Date.now()}`, created_at: now() }])
    navigator.vibrate?.(60)
    try {
      await api.addGoal(goal)
    } finally {
      reload()
    }
  }

  const undo = async () => {
    const lastGoal = goals.at(-1)
    if (!lastGoal || !confirm(t('match.confirmUndo'))) return
    setGoals((g) => g.slice(0, -1))
    await api.deleteGoal(lastGoal.id)
    // Undoing the deciding goal reopens the match (paused).
    if (finished) await api.updateMatch(id, { status: 'live', winner: null, ended_at: null, running_since: null })
    reload()
  }

  const endManually = (winner) => {
    setSheet(null)
    update({ status: 'finished', winner, clock_ms: shownElapsed(m), running_since: null, ended_at: now() }, { onlyLive: true })
  }

  const cancelMatch = async () => {
    if (!confirm(t('match.confirmCancel'))) return
    await api.deleteMatch(id)
    writeManaging(null)
    go('/tonight')
  }

  // A match that didn't really happen (a test, a mistake): admins remove it with its goals.
  const deletePlayed = async () => {
    if (!confirm(t('match.confirmDelete', { num: m.num }))) return
    try {
      await api.deleteMatch(id)
      go('/tonight')
    } catch {
      alert(t('match.deleteFailed'))
    }
  }

  const takeControl = () => {
    writeManaging(id)
    setManaging(true)
  }

  return (
    <main className="page match-page">
      <PageHeader
        title={t('match.num', { num: m.num })}
        back="#/tonight"
        action={control && (
          <button className="icon-btn" aria-label={t('match.options')} onClick={() => setSheet({ kind: 'menu' })}><Icon name="more" /></button>
        )}
      />

      <FinalTicks on={control && finalSeconds} left={left} />
      <div className={`clock-card${running ? ' running' : ''}${m.phase !== 'regular' ? ` phase-${m.phase}` : ''}${finalSeconds ? ' final-seconds' : ''}`}>
        <span className="phase-pill">{phaseLabel}</span>
        <div className="clock" dir="ltr">
          {finished
            ? formatClock(m.clock_ms)
            : onBreak
              ? formatClock(brk)
              : left === null ? formatClock(shownElapsed(m)) : formatClock(left)}
        </div>
        <span className="muted small">
          {finished
            ? t('match.played', { time: formatClock(m.clock_ms) })
            : onBreak
              ? brk > 0 ? t('match.breakLeft') : t('match.breakOver')
              : m.phase === 'golden'
                ? t('match.nextGoalWins')
                : winGoals(m)
                  ? t('match.firstTo', { count: winGoals(m) })
                  : t('match.untilTime')}
        </span>
      </div>

      {waitingPhase && (
        <div className="card phase-banner">
          <strong>{m.phase === 'extra' ? t('match.extraBanner', { count: extraMs(m) / 60_000 }) : t('match.goldenBanner')}</strong>
          <p className="muted">
            {m.phase === 'extra'
              ? winGoals(m)
                ? t('match.extraRuleGoals', { count: winGoals(m) })
                : t('match.extraRule')
              : t('match.goldenRule')}
          </p>
        </div>
      )}

      {onBreak && (
        <div className="card phase-banner">
          <strong>{t('match.breakTitle')}</strong>
          <p className="muted">{t('match.breakSub', { part: partName(periodOf(m)) })}</p>
        </div>
      )}

      {penalties && (
        <div className="card phase-banner">
          <strong>{t('match.penaltiesBanner')}</strong>
          <p className="muted">{t('match.penaltiesRule')}</p>
          {control && (
            <div className="row">
              <button className="btn team-a-bg" onClick={() => endManually('a')}>{t('match.wonOnPenalties', { team: TEAM.a.name })}</button>
              <button className="btn team-b-bg" onClick={() => endManually('b')}>{t('match.wonOnPenalties', { team: TEAM.b.name })}</button>
            </div>
          )}
        </div>
      )}

      {finished && (m.winner === 'draw' ? (
        <div className="card winner-card draw">
          <span className="winner-icon" aria-hidden="true">🤝</span>
          <strong>{t('match.drawResult')}</strong>
          <span className="winner-score" dir="ltr">{score.a} – {score.b}</span>
        </div>
      ) : (
        <div className={`card winner-card team-${m.winner}`}>
          <Icon name="trophy" size={34} />
          <strong>{t('match.teamWon', { team: TEAM[m.winner].name })}</strong>
          <span className="winner-score" dir="ltr">{Math.max(score.a, score.b)} – {Math.min(score.a, score.b)}</span>
        </div>
      ))}

      <div className="score-row">
        {['a', 'b'].map((side) => (
          <button
            key={side}
            type="button"
            className={`score-btn team-${side}${finished && m.winner === side ? ' won' : ''}`}
            disabled={!control}
            onClick={() => setSheet({ kind: 'goal', team: side })}
            aria-label={t('match.goalFor', { team: TEAM[side].name })}
          >
            <span className="score-team">{TEAM[side].name}</span>
            <span key={score[side]} className={`score-num${score[side] ? ' bump' : ''}`}>{score[side]}</span>
            <span className="score-faces">
              {m[`team_${side}`].map((pid) => byId[pid] && <Avatar key={pid} player={byId[pid]} size={22} />)}
            </span>
            {control && <span className="score-tap">{t('match.addGoal')}</span>}
          </button>
        ))}
      </div>

      {control && (
        <div className="controls">
          <button className="ctrl-btn" onClick={undo} disabled={goals.length === 0} aria-label={t('match.undoLastAria')}>
            <Icon name="undo" />
            <span>{t('match.undoGoal')}</span>
          </button>
          {running ? (
            <button className="ctrl-main" onClick={pause} aria-label={t('match.pauseClock')}><Icon name="pause" size={34} /></button>
          ) : (
            <button className="ctrl-main go" onClick={start} disabled={penalties} aria-label={t('match.startClock')}><Icon name="play" size={34} /></button>
          )}
          <button className="ctrl-btn" onClick={() => setSheet({ kind: 'menu' })} aria-label={t('match.options')}>
            <Icon name="more" />
            <span>{t('match.more')}</span>
          </button>
        </div>
      )}
      {control && !running && !penalties && (
        <p className="center muted small">
          {m.clock_ms === 0
            ? t('match.tapToStart')
            : onBreak
              ? t('match.tapToStartNext')
              : waitingPhase
                ? t(m.phase === 'extra' ? 'match.tapToStartExtra' : 'match.tapToStartGolden')
                : t('match.clockStopped')}
        </p>
      )}

      {!finished && !control && member && (
        <button className="btn" onClick={takeControl}>{t('match.takeControl')}</button>
      )}
      {!finished && member === false && <p className="note center">{t('match.viewOnly')}</p>}

      {finished && <MvpVote match={m} byId={byId} />}

      {finished && member && (
        <div className="stack">
          <a className="btn big" href={`#/next/${m.id}`}>{t('match.nextMatchLink')} <Icon name="forward" size={18} /></a>
          {managing && <button className="link-btn" onClick={undo}>{t('match.undoMistake')}</button>}
        </div>
      )}

      <button className="btn ghost" onClick={() => setSheet({ kind: 'lineup' })}>{t('match.lineups')}</button>
      {finished && admin && <button className="link-btn danger" onClick={deletePlayed}>{t('match.deletePlayed')}</button>}

      {goals.length > 0 && (
        <section className="stack">
          <h2 className="section-title">{t('match.goalsTitle')}</h2>
          <ol className="goal-list">
            {[...goals].reverse().map((g) => (
              <li key={g.id} className={`team-${g.team}`}>
                <span className="goal-time" dir="ltr">{formatClock(g.at_ms)}</span>
                <span className="goal-dot" />
                <span className="goal-who">
                  ⚽ {byId[g.scorer]?.name ?? t('match.unknown')}
                  {g.assist && byId[g.assist] && <small>{t('match.assistBy', { name: byId[g.assist].name })}</small>}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {sheet?.kind === 'goal' && (
        <GoalSheet
          team={sheet.team}
          players={m[`team_${sheet.team}`].map((pid) => byId[pid]).filter(Boolean)}
          onClose={() => setSheet(null)}
          onSave={addGoal}
        />
      )}
      {sheet?.kind === 'lineup' && (
        <Sheet title={t('match.lineupsTitle', { num: m.num })} onClose={() => setSheet(null)}>
          <Lineup teamA={m.team_a} teamB={m.team_b} byId={byId} />
        </Sheet>
      )}
      {sheet?.kind === 'menu' && (
        <Sheet title={t('match.options')} onClose={() => setSheet(null)}>
          <div className="stack">
            <p className="muted">{t('match.manualEnd')}</p>
            <div className="row">
              <button className="btn team-a-bg" onClick={() => endManually('a')}>{t('match.teamWon', { team: TEAM.a.name })}</button>
              <button className="btn team-b-bg" onClick={() => endManually('b')}>{t('match.teamWon', { team: TEAM.b.name })}</button>
            </div>
            {score.a === score.b && <button className="btn ghost" onClick={() => endManually('draw')}>🤝 {t('match.endDraw')}</button>}
            <button className="btn ghost" onClick={() => { writeManaging(null); setManaging(false); setSheet(null) }}>{t('match.stopManaging')}</button>
            <button className="link-btn danger" onClick={cancelMatch}>{t('match.cancelMatch')}</button>
          </div>
        </Sheet>
      )}
    </main>
  )
}

// A beep for each of the last 10 seconds, on the phone running the match.
function FinalTicks({ on, left }) {
  const second = on ? Math.ceil(left / 1000) : null
  useEffect(() => {
    if (second !== null && second > 0) play('tick')
  }, [second])
  return null
}

// Two steps: who scored, then who assisted (both optional).
function GoalSheet({ team, players, onClose, onSave }) {
  const [scorer, setScorer] = useState(undefined)

  if (scorer === undefined) {
    return (
      <Sheet title={t('match.whoScored', { team: TEAM[team].name })} onClose={onClose}>
        <div className="pick-grid">
          {players.map((p) => (
            <button key={p.id} className="pick" onClick={() => setScorer(p.id)}>
              <Avatar player={p} size={48} />
              <span>{p.name}</span>
            </button>
          ))}
          <button className="pick unknown" onClick={() => onSave(team, null, null)}>
            <span className="avatar" style={{ width: 48, height: 48, fontSize: 24 }}>❔</span>
            <span>{t('match.unknown')}</span>
          </button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={t('match.whoAssisted')} onClose={onClose}>
      <div className="pick-grid">
        {players.filter((p) => p.id !== scorer).map((p) => (
          <button key={p.id} className="pick" onClick={() => onSave(team, scorer, p.id)}>
            <Avatar player={p} size={48} />
            <span>{p.name}</span>
          </button>
        ))}
        <button className="pick unknown" onClick={() => onSave(team, scorer, null)}>
          <span className="avatar" style={{ width: 48, height: 48, fontSize: 24 }}>🚫</span>
          <span>{t('match.noAssist')}</span>
        </button>
      </div>
    </Sheet>
  )
}
