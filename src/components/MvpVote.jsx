import { useState } from 'react'
import { api } from '../data'
import { useLoad } from '../lib/hooks'
import { getMyCode } from '../lib/identity'
import { t } from '../i18n'
import Avatar from './Avatar'

// After a match: whoever played picks the player of the match (not themselves). Everyone sees the leader.
export default function MvpVote({ match, byId }) {
  const code = getMyCode()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data, reload } = useLoad(async () => {
    const [tally, me, mine] = await Promise.all([
      api.mvpTally().catch(() => []),
      code ? api.getVoter(code).catch(() => null) : null,
      code ? api.myMvpVotes(code).catch(() => []) : [],
    ])
    return {
      votes: tally.filter((v) => v.match_id === match.id),
      me,
      myPick: mine.find((v) => v.match_id === match.id)?.player_id ?? null,
    }
  }, [match.id, code])

  if (!data) return null

  const played = [...match.team_a, ...match.team_b]
  const iPlayed = data.me && played.includes(data.me.id)
  const top = Math.max(0, ...data.votes.map((v) => v.votes))
  const leaders = top > 0 ? data.votes.filter((v) => v.votes === top).map((v) => byId[v.player_id]).filter(Boolean) : []

  const pick = async (id) => {
    setBusy(true)
    setError('')
    try {
      await api.voteMvp(code, match.id, id)
      await reload()
    } catch {
      setError(t('match.voteFailed'))
    }
    setBusy(false)
  }

  return (
    <section className="card stack mvp">
      {leaders.length > 0 && (
        <div className="mvp-leader">
          <span className="mvp-crown">👑</span>
          <div className="mvp-faces">{leaders.map((p) => <Avatar key={p.id} player={p} size={52} />)}</div>
          <div>
            <span className="muted small">{t('match.mvp')}</span>
            <strong>{leaders.map((p) => p.name).join(' + ')}</strong>
            <span className="muted small">{t('match.votes', { count: top })}</span>
          </div>
        </div>
      )}

      {iPlayed ? (
        <>
          <h3>{data.myPick ? t('match.voted') : t('match.whoMvp')}</h3>
          <div className="pick-grid">
            {played.filter((id) => id !== data.me.id && byId[id]).map((id) => (
              <button
                key={id}
                className={`pick${data.myPick === id ? ' chosen' : ''} ${match.team_a.includes(id) ? 'side-a' : 'side-b'}`}
                onClick={() => pick(id)}
                disabled={busy}
              >
                <Avatar player={byId[id]} size={44} />
                <span>{byId[id].name}</span>
              </button>
            ))}
          </div>
          {error && <p className="err">{error}</p>}
        </>
      ) : (
        leaders.length === 0 && <p className="muted center">{t('match.mvpHelp')}</p>
      )}
    </section>
  )
}
