import { useMemo, useState } from 'react'
import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { getMyCode } from '../lib/identity'
import { positionsOf } from '../lib/positions'
import { FIELD_ATTRS, GK_ATTRS } from '../lib/attributes'
import { compareNames, t } from '../i18n'
import PageHeader from '../components/PageHeader'
import Avatar from '../components/Avatar'
import Loading from '../components/Loading'

// Rating by category: pick a category, give each name 1–5 (compared with the group). Every tap
// is saved right away; tapping the same score again clears it. Goalkeeping is rated only for
// players who play in goal. Nobody sees single ratings: the cards show the combined result.
export default function RateCategories() {
  const code = getMyCode()
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

  const set = async (playerId, attr, score) => {
    const key = `${playerId}|${attr}`
    const value = ratings[key] === score ? null : score
    const before = ratings
    setMine({ ...ratings, [key]: value })
    setFailed(false)
    try {
      await api.rateAttr(code, playerId, attr, value)
    } catch {
      setMine(before)
      setFailed(true)
    }
  }

  // Goalkeeping has four categories of its own, each rated in turn.
  const attrs = goalkeeping ? [gkTab] : [tab]
  const rated = (attr) => list.filter((p) => ratings[`${p.id}|${attr}`]).length

  return (
    <main className="page">
      <PageHeader title={t('stats.rate.title')} sub={t('stats.rate.sub')} back="#/" />
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
              {[1, 2, 3, 4, 5].map((n) => <li key={n}><b>{n}</b> {t(`stats.rate.scale.${n}`)}</li>)}
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
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n}: ${t(`stats.rate.scale.${n}`)}`}
                        className={value === n ? 'on' : ''} onClick={() => set(p.id, attr, n)}>{n}</button>
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
