import { useMemo } from 'react'
import { api } from '../data'
import { useLoad, useLiveUpdates } from '../lib/hooks'
import { getMyCode } from '../lib/identity'
import { useSchemaReady } from '../lib/schema'
import { today, dayLabel } from '../lib/dates'
import { computeAwards, computeStats } from '../lib/stats'
import { scoreOf } from '../lib/clock'
import { TEAM } from '../lib/teamsMeta'
import InstallHint from '../components/InstallHint'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import InviteButton from '../components/InviteButton'
import SignupCard from '../components/SignupCard'
import InviteCard from '../components/InviteCard'
import GroupSwitcher from '../components/GroupSwitcher'
import { unplaced } from '../lib/placement'

export default function Home() {
  const ready = useSchemaReady()
  const code = getMyCode()
  const day = today()

  const { data, reload } = useLoad(async () => {
    const me = code ? await api.getVoter(code).catch(() => null) : null
    if (!ready) return { me }
    const [players, night, history, myVotes] = await Promise.all([
      api.listPlayers(),
      api.getNight(day),
      api.getHistory(),
      me ? api.myMvpVotes(code).catch(() => []) : [],
    ])
    const attendance = night ? await api.listAttendance(night.id) : []
    return { me, players, night, attendance, history, myVotes }
  }, [ready, code, day])
  useLiveUpdates(reload)

  const view = useMemo(() => {
    if (!data?.history) return null
    const { players, night, attendance, history } = data
    const tonight = night ? history.matches.filter((m) => m.night_id === night.id) : []
    const live = tonight.find((m) => m.status === 'live')
    const stats = computeStats(players, history.matches, history.goals, history.mvp)
    const awards = computeAwards(stats)
    const active = players.filter((p) => p.active)
    // registered players first (newest first), then those who haven't signed up yet
    const roster = [...active].sort((x, y) => (y.claimed_at ?? '').localeCompare(x.claimed_at ?? ''))
    const last = [...history.matches].filter((m) => m.status === 'finished').sort((x, y) => (y.ended_at ?? '').localeCompare(x.ended_at ?? ''))[0]
    // A match I played in the last day that I haven't picked an MVP for yet.
    const meId = data.me?.id
    const voted = new Set((data.myVotes ?? []).map((v) => v.match_id))
    const toVote = meId
      ? history.matches
          .filter((m) => m.status === 'finished' && !voted.has(m.id) && [...m.team_a, ...m.team_b].includes(meId))
          .filter((m) => Date.now() - Date.parse(m.ended_at ?? m.created_at) < 24 * 3600_000)
          .sort((x, y) => (y.ended_at ?? '').localeCompare(x.ended_at ?? ''))[0]
      : null
    return {
      newOnes: unplaced(players, data.me),
      toVote,
      roster,
      registered: active.filter((p) => p.claimed_at).length,
      last,
      lastScore: last ? scoreOf(history.goals.filter((g) => g.match_id === last.id)) : null,
      byId: Object.fromEntries(players.map((p) => [p.id, p])),
      present: attendance.length,
      played: tonight.filter((m) => m.status === 'finished').length,
      live,
      liveScore: live ? scoreOf(history.goals.filter((g) => g.match_id === live.id)) : null,
      featured: awards.filter((a) => ['scorer', 'hot', 'duo'].includes(a.key)),
    }
  }, [data])

  const me = data?.me
  const groupName = me?.group?.name

  return (
    <main className="page home">
      <header className="hero">
        <div className="hero-pitch" aria-hidden="true" />
        {groupName ? <h1 className={groupName.length > 12 ? 'long' : ''}>{groupName}</h1> : <h1>כדורגל<br />שכונה</h1>}
        <p>{me ? `היי ${me.name}, מוכן למשחק?` : 'קבוצות הוגנות, בלי ויכוחים'}</p>
        <GroupSwitcher label="הקבוצות שלי" className="hero-switch" />
      </header>

      {me?.is_admin && view && view.roster.length <= 1 && (
        <section className="card stack">
          <strong>🎉 הקבוצה מוכנה! עכשיו מזמינים את החברים</strong>
          <p className="muted">שולחים את הקישור בקבוצת הוואטסאפ. כל אחד נרשם עם שם ותמונה, ומדרג את השאר. אפשר גם להוסיף רשימת שמות בעצמך, במסך הניהול.</p>
          <a className="btn ghost small" href="#/admin">➕ הוספת שחקנים בעצמי</a>
        </section>
      )}
      {me?.is_admin && view && view.roster.length <= 1 && <InviteCard />}

      {view?.live && (
        <a className="card live-card" href={`#/match/${view.live.id}`}>
          <span className="live-dot">משחק {view.live.num} חי עכשיו</span>
          <div className="live-score">
            <span className="team-a-text">{TEAM.a.short} {view.liveScore.a}</span>
            <span className="muted">–</span>
            <span className="team-b-text">{view.liveScore.b} {TEAM.b.short}</span>
          </div>
        </a>
      )}

      {view?.toVote && (
        <a className="card cta-card mvp-cta" href={`#/match/${view.toVote.id}`}>
          <div>
            <strong>👑 מי היה השחקן של משחק {view.toVote.num}?</strong>
            <p className="muted">שיחקת בו, אז יש לך קול. לוקח שנייה.</p>
          </div>
          <Icon name="forward" />
        </a>
      )}

      {view?.newOnes?.length > 0 && (
        <a className="card cta-card" href="#/place">
          <div>
            <strong>🆕 {view.newOnes.length === 1 ? `נוסף שחקן חדש: ${view.newOnes[0].name}` : `נוספו ${view.newOnes.length} שחקנים חדשים`}</strong>
            <p className="muted">איפה הוא אצלך בדירוג? לחיצה אחת.</p>
          </div>
          <Icon name="forward" />
        </a>
      )}

      {me && ready && !me.ranking && view?.roster?.length > 2 && (
        <a className="card cta-card rank-cta" href={`#/v/${code}`}>
          <div>
            <strong>🗳️ עוד לא דירגת את השחקנים</strong>
            <p className="muted">לוקח דקה, ועושים את זה פעם אחת. ככה הקבוצות יוצאות שוות.</p>
          </div>
          <Icon name="forward" />
        </a>
      )}

      {ready && <SignupCard />}

      <div className="tile-grid">
        <a className="tile tile-main" href="#/tonight">
          <Icon name="pitch" size={28} />
          <strong>הערב</strong>
          <span>{view ? (view.present ? `${view.present} הגיעו, ${view.played} משחקים` : 'מי מגיע? חלוקה לקבוצות') : dayLabel(day)}</span>
        </a>
        <a className="tile" href="#/stats">
          <Icon name="chart" size={24} />
          <strong>סטטיסטיקה</strong>
          <span>פרסים וכרטיסים</span>
        </a>
        <a className="tile" href={code ? `#/v/${code}` : '#/vote'}>
          <span className="tile-emoji">🗳️</span>
          <strong>דירוג שחקנים</strong>
          <span>{me?.ranking ? 'עדכן את הדירוג' : 'סודי, רק המנהלים רואים'}</span>
        </a>
      </div>

      {view?.last && (
        <a className="card last-result" href={`#/match/${view.last.id}`}>
          <span className="muted small">המשחק האחרון</span>
          <div className="last-score">
            <span className={view.last.winner === 'a' ? 'won' : ''} style={{ '--c': TEAM.a.color }}>{TEAM.a.name} <b>{view.lastScore.a}</b></span>
            <span className="muted">–</span>
            <span className={view.last.winner === 'b' ? 'won' : ''} style={{ '--c': TEAM.b.color }}><b>{view.lastScore.b}</b> {TEAM.b.name}</span>
          </div>
        </a>
      )}

      {view?.roster?.length > 0 && (
        <section className="stack">
          <div className="section-head">
            <h2 className="section-title">השחקנים שלנו</h2>
            <span className="muted small">{view.registered} מתוך {view.roster.length} נרשמו</span>
          </div>
          <div className="roster">
            {view.roster.map((p) => (
              <a key={p.id} href={`#/card/${p.id}`} className={`roster-item${p.claimed_at ? '' : ' pending'}`}>
                <Avatar player={p} size={52} />
                <span>{p.name}</span>
              </a>
            ))}
          </div>
          {me && <InviteButton />}
        </section>
      )}

      {me && ready && !view?.roster?.length && <InviteButton />}

      {view?.featured?.length > 0 && (
        <section className="stack">
          <h2 className="section-title">על הפודיום</h2>
          <div className="featured">
            {view.featured.map((a) => (
              <a key={a.key} className="featured-item" href={`#/card/${a.ids.at(-1)}`}>
                <span className="award-emoji">{a.emoji}</span>
                <span className="award-faces">{a.ids.map((id) => view.byId[id] && <Avatar key={id} player={view.byId[id]} size={26} />)}</span>
                <span className="featured-text">
                  <strong>{a.title}</strong>
                  <small>{a.ids.map((id) => view.byId[id]?.name).filter(Boolean).join(' + ')}: {a.text}</small>
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      <InstallHint />

      {me?.is_admin && (
        <a className="admin-entry" href="#/admin">
          <Icon name="gear" size={18} />
          ניהול הקבוצה
        </a>
      )}
    </main>
  )
}
