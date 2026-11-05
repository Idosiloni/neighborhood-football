import { useMemo, useState } from 'react'
import { overallOf, toDisplay } from '../lib/attributes'
import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { getMyCode } from '../lib/identity'
import { positionsOf } from '../lib/positions'
import { FIELD_ATTRS, GK_ATTRS } from '../lib/attributes'
import { compareNames, t } from '../i18n'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import Loading from '../components/Loading'

const MODE = 'rate-mode' // 'player' (default) or 'category', remembered on this phone
const readMode = () => {
  try {
    return localStorage.getItem(MODE) === 'category' ? 'category' : 'player'
  } catch {
    return 'player'
  }
}
const SCORES = [1, 2, 3, 4, 5]

// The categories a player is rated in: goalkeeping for those who play in goal, the field ones for the rest.
function attrsOf(p) {
  const pos = positionsOf(p)
  if (pos.length === 1 && pos[0] === 'gk') return GK_ATTRS
  return pos.includes('gk') ? [...FIELD_ATTRS, ...GK_ATTRS] : FIELD_ATTRS
}

// Rating by category: 1–5 compared with the group, shown as the card's numbers (45 … 95).
// Two ways: player by player (one tap sets an overall level for every category, then adjust
// what stands out), or category by category for everyone. Every tap is saved right away;
// tapping the same score again clears it. Nobody sees single ratings: the cards show the combined result.
export default function RateCategories() {
  const code = getMyCode()
  const [mode, setModeState] = useState(readMode)
  const setMode = (m) => {
    setModeState(m)
    try {
      localStorage.setItem(MODE, m)
    } catch {
      // private mode
    }
  }
  const [tab, setTab] = useState('spd')
  const [mine, setMine] = useState(null)
  const [failed, setFailed] = useState(false)

  const { data } = useLoad(async () => {
    if (!code) return null
    const [me, players, ratings] = await Promise.all([api.getVoter(code), api.listPlayers(), api.myAttrRatings(code)])
    return { me, players, ratings }
  }, [code])

  const ratings = useMemo(() => {
    if (mine) return mine
    if (!data) return {}
    return Object.fromEntries(data.ratings.map((r) => [`${r.player_id}|${r.attr}`, r.score]))
  }, [data, mine])

  if (!code) {
    return (
      <main className="page">
        <PageHeader title={t('stats.rate.title')} back="#/" />
        <p className="note">{t('stats.rate.needLink')}</p>
      </main>
    )
  }
  if (!data) return <main className="page"><PageHeader title={t('stats.rate.title')} back="#/" /><Loading /></main>

  const others = data.players.filter((p) => p.active && p.id !== data.me?.id).sort((a, b) => compareNames(a.name, b.name))
  const keepers = others.filter((p) => positionsOf(p).includes('gk'))
  const goalkeeping = GK_ATTRS.includes(tab)
  const list = goalkeeping ? keepers : others
  const tabs = [...FIELD_ATTRS, ...(keepers.length ? ['gk'] : [])]
  const gkTab = goalkeeping ? tab : null

  // Several categories at once (the overall level); one tap = toggle that score.
  const save = async (changes) => {
    const before = ratings
    setMine({ ...ratings, ...Object.fromEntries(changes.map(([pid, attr, v]) => [`${pid}|${attr}`, v])) })
    setFailed(false)
    try {
      await Promise.all(changes.map(([pid, attr, v]) => api.rateAttr(code, pid, attr, v)))
    } catch {
      setMine(before)
      setFailed(true)
    }
  }
  const set = (playerId, attr, score) => save([[playerId, attr, ratings[`${playerId}|${attr}`] === score ? null : score]])

  const toggle = (
    <div className="view-toggle">
      {['player', 'category'].map((m) => (
        <button key={m} className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => setMode(m)}>{t(`stats.rate.mode.${m}`)}</button>
      ))}
    </div>
  )

  if (mode === 'player') {
    return (
      <main className="page">
        <PageHeader title={t('stats.rate.title')} sub={t('stats.rate.sub')} back="#/" />
        {toggle}
        <ByPlayer players={others} ratings={ratings} set={set} save={save} />
        {failed && <p className="err">{t('stats.rate.failed')}</p>}
        <p className="muted small">{t('stats.rate.secret')}</p>
      </main>
    )
  }

  // Goalkeeping has four categories of its own, each rated in turn.
  const attrs = goalkeeping ? [gkTab] : [tab]
  const rated = (attr) => list.filter((p) => ratings[`${p.id}|${attr}`]).length

  return (
    <main className="page">
      <PageHeader title={t('stats.rate.title')} sub={t('stats.rate.sub')} back="#/" />
      {toggle}
      <p className="muted small">{t('stats.rate.howTo')}</p>
      <div className="chips cat-tabs" role="tablist">
        {tabs.map((x) => {
          const on = x === 'gk' ? goalkeeping : tab === x
          return (
            <button key={x} type="button" role="tab" aria-selected={on} className={on ? 'on' : ''}
              onClick={() => setTab(x === 'gk' ? 'gk_ref' : x)}>
              {x === 'gk' ? `🧤 ${t('stats.cats.goalkeeping')}` : t(`stats.cats.${x}`)}
            </button>
          )
        })}
      </div>
      {goalkeeping && (
        <div className="chips">
          {GK_ATTRS.map((x) => (
            <button key={x} type="button" className={tab === x ? 'on' : ''} aria-pressed={tab === x} onClick={() => setTab(x)}>{t(`stats.cats.${x}`)}</button>
          ))}
        </div>
      )}

      {attrs.map((attr) => (
        <section key={attr} className="stack">
          <div className="card stack rate-head">
            <strong>{t(`stats.cats.long.${attr}`)}</strong>
            <span className="muted small">{t('stats.rate.progress', { n: rated(attr), total: list.length, attr: t(`stats.cats.${attr}`) })}</span>
            <ol className="rate-scale">
              {SCORES.map((n) => <li key={n}><b>{toDisplay(n)}</b> {t(`stats.rate.scale.${n}`)}</li>)}
            </ol>
          </div>
          <ul className="player-list">
            {list.map((p) => {
              const value = ratings[`${p.id}|${attr}`]
              return (
                <li key={p.id} className="card rate-row">
                  <Avatar player={p} size={34} />
                  <span className="rank-name">{p.name}</span>
                  <span className="rate-chips" role="radiogroup" aria-label={`${p.name}: ${t(`stats.cats.${attr}`)}`}>
                    {SCORES.map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${toDisplay(n)}: ${t(`stats.rate.scale.${n}`)}`}
                        className={value === n ? 'on' : ''} onClick={() => set(p.id, attr, n)}>{toDisplay(n)}</button>
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {failed && <p className="err">{t('stats.rate.failed')}</p>}
      <p className="muted small">{t('stats.rate.secret')}</p>
    </main>
  )
}

// One player at a time, like building their card: an overall level for every category in one tap,
// then each category on its own. Starts at the first player not fully rated yet.
function ByPlayer({ players, ratings, set, save }) {
  const done = (p) => attrsOf(p).every((a) => ratings[`${p.id}|${a}`])
  const [i, setI] = useState(() => Math.max(0, players.findIndex((p) => !done(p))))
  if (!players.length) return null
  const p = players[Math.min(i, players.length - 1)]
  const attrs = attrsOf(p)
  const value = (a) => ratings[`${p.id}|${a}`]
  const shown = Object.fromEntries(attrs.filter(value).map((a) => [a, toDisplay(value(a))]))
  const preview = overallOf(shown, positionsOf(p).length ? positionsOf(p) : ['any'])?.value
  const allDone = players.every(done)
  const go = (d) => {
    setI((x) => (x + d + players.length) % players.length)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <section className="card stack rate-player">
        <div className="rate-who">
          <Avatar player={p} size={56} />
          <span className="stack tight">
            <strong className="rate-name">{p.name}</strong>
            <span className="muted small">{t('stats.rate.of', { n: players.indexOf(p) + 1, total: players.length })}</span>
          </span>
          <span className={`rate-preview${preview ? '' : ' empty'}`} aria-label={t('stats.rate.preview', { n: preview ?? '?' })}>{preview ?? '?'}</span>
        </div>

        <div className="rate-quick">
          <strong className="small">{t('stats.rate.overall')}</strong>
          <span className="rate-chips words" role="group" aria-label={t('stats.rate.overall')}>
            {SCORES.map((n) => (
              <button key={n} type="button" onClick={() => save(attrs.map((a) => [p.id, a, n]))} aria-label={t(`stats.rate.scale.${n}`)}>
                {t(`stats.rate.short.${n}`)}
              </button>
            ))}
          </span>
          <small className="muted">{t('stats.rate.overallHint')}</small>
        </div>

        {attrs.map((a) => (
          <div key={a} className="rate-line">
            <span className="small">{t(`stats.cats.long.${a}`)}</span>
            <span className="rate-chips" role="radiogroup" aria-label={`${p.name}: ${t(`stats.cats.${a}`)}`}>
              {SCORES.map((n) => (
                <button key={n} type="button" role="radio" aria-checked={value(a) === n} aria-label={`${toDisplay(n)}: ${t(`stats.rate.scale.${n}`)}`}
                  className={value(a) === n ? 'on' : ''} onClick={() => set(p.id, a, n)}>{toDisplay(n)}</button>
              ))}
            </span>
          </div>
        ))}
        <small className="muted">{t('stats.rate.howToPlayer')}</small>
      </section>
      {allDone && <p className="ok center">{t('stats.rate.allDone')}</p>}
      <div className="row-btns rate-nav">
        <button className="btn ghost" onClick={() => go(-1)}>{t('stats.rate.prev')}</button>
        <button className="btn" onClick={() => go(1)}>{done(p) ? t('stats.rate.next') : t('stats.rate.skip')}</button>
      </div>
    </>
  )
}
