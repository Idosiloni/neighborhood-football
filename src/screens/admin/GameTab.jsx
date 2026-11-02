import { useState } from 'react'
import { api } from '../../data'
import { useLoad } from '../../lib/hooks'
import { gameLabel, nextGameDay } from '../../lib/dates'
import { RulesFields, WhenFields } from '../../components/GameSettings'
import { forgetSchedule } from '../../lib/schedule'

// The group's name, when and where we play, the game rules, and switching off one week.
export default function GameTab({ group, reload: reloadGroup }) {
  const { data, reload } = useLoad(async () => {
    const schedule = await api.getSchedule()
    const day = nextGameDay(new Date(), schedule)
    const night = await api.getNight(day)
    return { schedule, day, cancelled: Boolean(night?.cancelled) }
  }, [])
  const [draft, setDraft] = useState(null)
  const [status, setStatus] = useState('')

  if (!data) return <p className="center muted">טוען…</p>
  const s = draft ?? data.schedule

  const save = async () => {
    setStatus('saving')
    try {
      await api.saveSchedule({ ...s, venue: s.venue?.trim() || null })
      forgetSchedule()
      setDraft(null)
      await reload()
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  const toggleWeek = async () => {
    const off = !data.cancelled
    if (off && !confirm(`לבטל את המשחק של ${gameLabel(data.day, data.schedule)}? כולם יראו "אין משחק השבוע".`)) return
    await api.setCancelled(data.day, off)
    await reload()
  }

  return (
    <section className="stack">
      {group && <GroupName group={group} onSaved={reloadGroup} />}

      <div className="card stack">
        <h2>המשחק הקרוב</h2>
        <p className="big-day">{gameLabel(data.day, data.schedule)}</p>
        {data.cancelled ? (
          <>
            <p className="err">בוטל. השחקנים רואים "אין משחק השבוע".</p>
            <button className="btn" onClick={toggleWeek}>החזר את המשחק</button>
          </>
        ) : (
          <button className="btn ghost" onClick={toggleWeek}>אין משחק השבוע</button>
        )}
      </div>

      <div className="card stack">
        <h2>המשחק הקבוע</h2>
        <WhenFields value={s} onChange={setDraft} />
        <h2>חוקי המשחק</h2>
        <RulesFields value={s} onChange={setDraft} />
        <p className="muted small">משחק שכבר התחיל ממשיך עם החוקים שהיו כשהתחיל.</p>
        {status === 'saved' && !draft && <p className="ok">✓ נשמר</p>}
        {status === 'error' && <p className="err">השמירה נכשלה</p>}
        <button className="btn" onClick={save} disabled={!draft || status === 'saving'}>שמור</button>
      </div>
    </section>
  )
}

function GroupName({ group, onSaved }) {
  const [name, setName] = useState(group.name)
  const [status, setStatus] = useState('')
  const changed = name.trim() && name.trim() !== group.name

  const save = async (e) => {
    e.preventDefault()
    setStatus('saving')
    try {
      await api.saveGroup({ name })
      await onSaved()
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  return (
    <form className="card stack" onSubmit={save}>
      <h2>שם הקבוצה</h2>
      <input className="input" value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setStatus('') }} aria-label="שם הקבוצה" />
      {status === 'saved' && !changed && <p className="ok">✓ נשמר</p>}
      {status === 'error' && <p className="err">השמירה נכשלה</p>}
      <button className="btn" disabled={!changed || status === 'saving'}>שמור</button>
    </form>
  )
}
