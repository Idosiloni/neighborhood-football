import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../data'
import { today, dayLabel } from '../lib/dates'
import { useLoad, useLiveUpdates } from '../lib/hooks'
import { useMember } from '../lib/member'
import { useSchemaReady } from '../lib/schema'
import { minPlayers, suggestBench } from '../lib/teams'
import { useSchedule } from '../lib/schedule'
import { go } from '../lib/router'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import TeamBoard from '../components/TeamBoard'
import MatchRow from '../components/MatchRow'
import NeedsUpdate from '../components/NeedsUpdate'
import Icon from '../components/Icon'
import { writeManaging } from '../lib/managing'
import { normalizeName, parseNames } from '../lib/parseList'
import Sheet from '../components/Sheet'
import Lineup from '../components/Lineup'
import { play } from '../lib/sound'
import { t } from '../i18n'

export default function Tonight() {
  const ready = useSchemaReady()
  const day = today()

  return (
    <main className="page">
      <PageHeader title={t('match.tonight')} sub={dayLabel(day)} />
      {ready === false ? <NeedsUpdate /> : ready ? <TonightBody day={day} /> : <p className="center muted">{t('common.loading')}</p>}
    </main>
  )
}

function TonightBody({ day }) {
  const member = useMember()
  const { team_size: teamSize } = useSchedule()
  const MIN_PLAYERS = minPlayers(teamSize)
  const [busy, setBusy] = useState(false)
  const [builder, setBuilder] = useState(false)
  const [pasting, setPasting] = useState(false)

  const { data, error, reload } = useLoad(async () => {
    const [players, night, history] = await Promise.all([api.listPlayers(), api.getNight(day), api.getHistory()])
    const attendance = night ? await api.listAttendance(night.id) : []
    return { players, night, attendance, history }
  }, [day])
  useLiveUpdates(reload)

  const view = useMemo(() => {
    if (!data) return null
    const { players, night, attendance, history } = data
    const byId = Object.fromEntries(players.map((p) => [p.id, p]))
    const present = new Set(attendance.map((a) => a.player_id))
    const matches = night ? history.matches.filter((m) => m.night_id === night.id).sort((x, y) => x.num - y.num) : []
    return { players, byId, present, matches, night, attendance, history }
  }, [data])

  if (error && !data) return <p className="err center">{t('common.offline')}</p>
  if (!view) return <p className="center muted">{t('common.loading')}</p>

  const { players, byId, present, matches, night, attendance, history } = view
  const live = matches.find((m) => m.status === 'live')
  const last = matches.at(-1)
  const active = players.filter((p) => p.active)
  // Who came first, in order of arrival; everyone else after them.
  const arrival = new Map(attendance.map((a, i) => [a.player_id, i]))
  const grid = [...active].sort((x, y) => (arrival.get(x.id) ?? 1e9) - (arrival.get(y.id) ?? 1e9))

  const toggle = async (id) => {
    if (!member || busy) return
    setBusy(true)
    try {
      const n = night ?? (await api.ensureNight(day))
      await api.setPresent(n.id, id, !present.has(id))
      await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {live && <LiveCard match={live} goals={history.goals} />}

      {!live && last?.status === 'finished' && !builder && (
        <div className="card cta-card">
          <div>
            <strong>{t('match.numFinished', { num: last.num })}</strong>
            <p className="muted">{t('match.winnerStays')}</p>
          </div>
          {member && (
            <a className="btn" href={`#/next/${last.id}`}>{t('match.nextMatch')} <Icon name="forward" size={18} /></a>
          )}
        </div>
      )}

      {!live && (
        <section className="card stack">
          <div className="section-head">
            <h2>{t('match.whoCame')}</h2>
            <span className="pill">{t('match.cameCount', { count: present.size })}</span>
          </div>
          {member && (
            <button className="btn ghost small" onClick={() => setPasting(true)}>{t('match.pasteButton')}</button>
          )}
          {member === false && (
            <p className="note">{t('match.needLink')}</p>
          )}
          <div className="attend-grid">
            {grid.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`attend${present.has(p.id) ? ' on' : ''}`}
                onClick={() => toggle(p.id)}
                disabled={!member}
                aria-pressed={present.has(p.id)}
              >
                <Avatar player={p} size={44} />
                <span>{p.name}</span>
                {present.has(p.id) && <span className="attend-check"><Icon name="check" size={14} stroke={3} /></span>}
              </button>
            ))}
          </div>
          {active.length === 0 && <p className="muted center">{t('match.noPlayers')}</p>}

          {member && !builder && (matches.length === 0 || last?.status === 'finished') && (
            <button className="btn big" disabled={present.size < MIN_PLAYERS} onClick={() => setBuilder(true)}>
              {matches.length === 0 ? t('match.splitTeams') : t('match.splitAgain')}
            </button>
          )}
          {member && present.size < MIN_PLAYERS && <p className="muted center small">{t('match.needPlayers', { count: MIN_PLAYERS })}</p>}
        </section>
      )}

      {pasting && (
        <PasteList
          players={active}
          onClose={() => setPasting(false)}
          onDone={async (ids) => {
            const n = night ?? (await api.ensureNight(day))
            // One by one, so the order of the list is the order of arrival (last ones wait first).
            for (const id of ids) if (!present.has(id)) await api.setPresent(n.id, id, true)
            setPasting(false)
            await reload()
          }}
        />
      )}

      {builder && night && !live && (
        <TeamBuilder
          teamSize={teamSize}
          night={night}
          attendance={attendance}
          byId={byId}
          history={history}
          nextNum={(last?.num ?? 0) + 1}
          onCancel={() => setBuilder(false)}
        />
      )}

      {matches.length > 0 && (
        <section className="stack">
          <h2 className="section-title">{t('match.tonightMatches')}</h2>
          {[...matches].reverse().map((m) => <MatchRow key={m.id} match={m} goals={history.goals} />)}
        </section>
      )}
    </>
  )
}

function LiveCard({ match, goals }) {
  const a = goals.filter((g) => g.match_id === match.id && g.team === 'a').length
  const b = goals.filter((g) => g.match_id === match.id && g.team === 'b').length
  return (
    <a className="card live-card" href={`#/match/${match.id}`}>
      <span className="live-dot">{t('match.live', { num: match.num })}</span>
      <div className="live-score">
        <span className="team-a-text">{a}</span>
        <span className="muted">–</span>
        <span className="team-b-text">{b}</span>
      </div>
      <span className="muted small">{t('match.tapToWatch')}</span>
    </a>
  )
}

function TeamBuilder({ night, attendance, byId, history, nextNum, teamSize, onCancel }) {
  const presentPlayers = attendance.filter((a) => byId[a.player_id]?.active).map((a) => ({ ...byId[a.player_id], night_id: night.id, arrived_at: a.arrived_at }))
  const benchCount = Math.max(0, presentPlayers.length - teamSize * 2)
  const [groups, setGroups] = useState(null)
  const [dealt, setDealt] = useState(0) // each new split deals the players onto the pitch again
  const [view, setView] = useState('pitch') // pitch | edit
  const [state, setState] = useState('idle') // idle | loading | starting | error
  const [message, setMessage] = useState('')

  const roll = useCallback(
    async (bench) => {
      setState('loading')
      try {
        const { a, b } = await api.makeTeams(night.id, bench)
        setGroups({ a, b, bench })
        setDealt((n) => n + 1)
        play('reveal')
        setState('idle')
      } catch {
        setState('error')
        setMessage(t('match.splitFailed'))
      }
    },
    [night.id],
  )

  useEffect(() => {
    roll(suggestBench(presentPlayers, history.matches, benchCount))
    // only once, when the builder opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = async () => {
    setState('starting')
    try {
      const m = await api.createMatch({ night_id: night.id, num: nextNum, team_a: groups.a, team_b: groups.b, bench: groups.bench })
      writeManaging(m.id) // whoever starts the match runs it
      go(`/match/${m.id}`)
    } catch {
      setState('error')
      setMessage(t('match.alreadyStarted'))
    }
  }

  return (
    <section className="card stack">
      <div className="section-head">
        <h2>{t('match.teams')}</h2>
        <button className="link-btn" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
      {!groups ? (
        <p className="center muted">{state === 'error' ? message : t('match.splitting')}</p>
      ) : (
        <>
          <div className="view-toggle">
            <button className={view === 'pitch' ? 'on' : ''} onClick={() => setView('pitch')}>{t('match.viewPitch')}</button>
            <button className={view === 'edit' ? 'on' : ''} onClick={() => setView('edit')}>{t('match.viewEdit')}</button>
          </div>
          {view === 'pitch' ? (
            <Lineup key={dealt} teamA={groups.a} teamB={groups.b} byId={byId} deal />
          ) : (
            <TeamBoard groups={groups} playersById={byId} onChange={setGroups} editable />
          )}
          {view === 'pitch' && groups.bench.length > 0 && (
            <p className="muted small">{t('match.waiting', { names: groups.bench.map((id) => byId[id]?.name).filter(Boolean).join(', ') })}</p>
          )}
          {state === 'error' && <p className="err">{message}</p>}
          <div className="row">
            <button className="btn ghost" onClick={() => roll(groups.bench)} disabled={state !== 'idle' && state !== 'error'}>
              <Icon name="dice" size={18} /> {t('match.reroll')}
            </button>
            <button className="btn" onClick={start} disabled={state === 'starting' || groups.a.length === 0 || groups.b.length === 0}>
              <Icon name="play" size={18} /> {t('match.startMatch')}
            </button>
          </div>
          {view === 'edit' && groups.bench.length > 0 && <p className="muted small">{t('match.benchNote')}</p>}
        </>
      )}
    </section>
  )
}

// Loose match: ignores hidden characters, spaces, hyphens and quotes ("בר-לב" = "בר לב", "O'Brien" = "OBrien").
const matchKey = (name) => normalizeName(name).replace(/[-'"\u05F3\u05F4\u2018\u2019.\s]/g, '')

// Paste the WhatsApp sign-up list: known names are marked present in list order;
// an admin can add the unknown ones as new players on the spot.
function PasteList({ players, onClose, onDone }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const { data: admin } = useLoad(() => api.getAdmin().catch(() => null), [])

  const byKey = new Map(players.map((p) => [matchKey(p.name), p]))
  const names = parseNames(text)
  const known = names.map((n) => byKey.get(matchKey(n))).filter(Boolean)
  const unknown = names.filter((n) => !byKey.has(matchKey(n)))

  const confirm = async () => {
    setBusy(true)
    setError('')
    try {
      const ids = []
      for (const n of names) {
        const p = byKey.get(matchKey(n))
        if (p) ids.push(p.id)
        else if (admin) ids.push((await api.savePlayer({ name: n, emoji: '⚽', photo: null, position: 'any', can_gk: false, active: true })).id)
      }
      await onDone(ids)
    } catch {
      setError(t('match.saveFailed'))
      setBusy(false)
    }
  }

  return (
    <Sheet title={t('match.pasteTitle')} onClose={onClose}>
      <div className="stack">
        <p className="muted small">{t('match.pasteHelp')}</p>
        <textarea className="input textarea" rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('match.pastePlaceholder')} />
        {known.length > 0 && <p className="ok">{t('match.willMark', { count: known.length, names: known.map((p) => p.name).join(', ') })}</p>}
        {unknown.length > 0 && (
          <p className={admin ? 'muted small' : 'err'}>
            {admin
              ? t('match.willAdd', { count: unknown.length, names: unknown.join(', ') })
              : t('match.unknownNames', { names: unknown.join(', ') })}
          </p>
        )}
        {error && <p className="err">{error}</p>}
        <button className="btn big" onClick={confirm} disabled={busy || names.length === 0 || (known.length === 0 && !admin)}>
          {busy ? t('match.marking') : t('match.markPresent')}
        </button>
      </div>
    </Sheet>
  )
}
