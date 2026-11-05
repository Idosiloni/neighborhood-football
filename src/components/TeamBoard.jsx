import { useState } from 'react'
import Avatar from './Avatar'
import { TEAM } from '../lib/teamsMeta'
import { t } from '../i18n'

// Titles are read when shown (the language can change while the app runs).
const groupsList = () => [
  { key: 'a', title: TEAM.a.name, cls: 'team-a' },
  { key: 'b', title: TEAM.b.name, cls: 'team-b' },
  { key: 'bench', title: t('match.bench'), cls: 'bench' },
]

// Shows both teams and the bench. When editable: tap a player, then tap another to swap them,
// or tap "העברה לכאן" ("Move here") to move them to a different group.
export default function TeamBoard({ groups, playersById, onChange, editable = false, marks = {} }) {
  const [picked, setPicked] = useState(null) // { id, from }

  const tap = (id, from) => {
    if (!editable) return
    if (!picked) return setPicked({ id, from })
    if (picked.id === id) return setPicked(null)
    const next = { a: [...groups.a], b: [...groups.b], bench: [...groups.bench] }
    const i = next[picked.from].indexOf(picked.id)
    const j = next[from].indexOf(id)
    next[picked.from][i] = id
    next[from][j] = picked.id
    setPicked(null)
    onChange(next)
  }

  const moveTo = (to) => {
    const next = { a: [...groups.a], b: [...groups.b], bench: [...groups.bench] }
    next[picked.from] = next[picked.from].filter((x) => x !== picked.id)
    next[to].push(picked.id)
    setPicked(null)
    onChange(next)
  }

  return (
    <div className="team-board">
      {editable && <p className="hint-line">{picked ? t('match.swapPicked') : t('match.swapHint')}</p>}
      {groupsList().filter((g) => g.key !== 'bench' || groups.bench.length > 0 || picked).map((g) => (
        <section key={g.key} className={`team-col ${g.cls}`}>
          <h3>
            {g.title} <span className="count">{groups[g.key].length}</span>
          </h3>
          <ul>
            {groups[g.key].map((id) => {
              const p = playersById[id]
              if (!p) return null
              const mark = marks[id]
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`team-player${picked?.id === id ? ' picked' : ''}${mark ? ` mark-${mark}` : ''}`}
                    onClick={() => tap(id, g.key)}
                    disabled={!editable}
                  >
                    <Avatar player={p} size={32} />
                    <span>{p.name}</span>
                    {p.position === 'gk' && <span className="tag">🧤</span>}
                    {mark === 'in' && <span className="tag in">{t('match.markIn')}</span>}
                  </button>
                </li>
              )
            })}
            {picked && picked.from !== g.key && (
              <li>
                <button type="button" className="team-player move-here" onClick={() => moveTo(g.key)}>
                  {t('match.moveHere')}
                </button>
              </li>
            )}
          </ul>
        </section>
      ))}
    </div>
  )
}
