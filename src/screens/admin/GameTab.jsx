import { useState } from 'react'
import { api } from '../../data'
import { useLoad } from '../../lib/hooks'
import { gameLabel, nextGameDay } from '../../lib/dates'
import { LevelFields, RulesFields, WhenFields } from '../../components/GameSettings'
import { forgetSchedule } from '../../lib/schedule'
import { setGroupLanguage, t } from '../../i18n'
import { optionsOf } from '../../lib/options'
import { applyTeamColors } from '../../lib/teamColors'

const RULE_KEYS = ['format', 'periods', 'break_minutes', 'extra_minutes', 'tie', 'team_a', 'team_b']

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

  if (!data) return <p className="center muted">{t('common.loading')}</p>
  const s = draft ?? data.schedule

  const save = async () => {
    setStatus('saving')
    try {
      await api.saveSchedule({ ...s, venue: s.venue?.trim() || null })
      // The game options (format, halves, tie rule…) live with the group's other options; the language stays.
      if (group && 'options' in group && s.options) {
        // Only the game rules: the language and the level have their own cards (and save right away).
        const rules = Object.fromEntries(RULE_KEYS.map((k) => [k, optionsOf(s)[k]]))
        const saved = await api.saveOptions(rules)
        applyTeamColors(saved)
        forgetSchedule()
        await reloadGroup()
      }
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
    if (off && !confirm(t('admin.game.confirmCancel', { when: gameLabel(data.day, data.schedule) }))) return
    await api.setCancelled(data.day, off)
    await reload()
  }

  return (
    <section className="stack">
      {group && <GroupName group={group} onSaved={reloadGroup} />}
      {group && 'options' in group && <GroupLevel group={group} onSaved={reloadGroup} />}
      {group && 'options' in group && <GroupLanguage group={group} onSaved={reloadGroup} />}

      <div className="card stack">
        <h2>{t('admin.game.next')}</h2>
        <p className="big-day">{gameLabel(data.day, data.schedule)}</p>
        {data.cancelled ? (
          <>
            <p className="err">{t('admin.game.cancelled')}</p>
            <button className="btn" onClick={toggleWeek}>{t('admin.game.restore')}</button>
          </>
        ) : (
          <button className="btn ghost" onClick={toggleWeek}>{t('admin.game.noGameThisWeek')}</button>
        )}
      </div>

      <div className="card stack">
        <h2>{t('admin.game.regular')}</h2>
        <WhenFields value={s} onChange={setDraft} />
        <h2>{t('admin.game.rules')}</h2>
        <RulesFields value={s} onChange={setDraft} />
        <p className="muted small">{t('admin.game.rulesNote')}</p>
        {status === 'saved' && !draft && <p className="ok">{t('admin.saved')}</p>}
        {status === 'error' && <p className="err">{t('admin.saveFailed')}</p>}
        <button className="btn" onClick={save} disabled={!draft || status === 'saving'}>{t('common.save')}</button>
      </div>
    </section>
  )
}

// How much the players do (saved right away, like the language).
function GroupLevel({ group, onSaved }) {
  const [options, setOptions] = useState(() => optionsOf(group))
  const [status, setStatus] = useState('')
  const change = async (fields) => {
    const before = options
    setOptions({ ...options, ...fields })
    setStatus('saving')
    try {
      await api.saveOptions(fields)
      forgetSchedule()
      await onSaved()
      setStatus('saved')
    } catch {
      setOptions(before)
      setStatus('error')
    }
  }
  return (
    <div className="card stack">
      <LevelFields value={options} onChange={change} disabled={status === 'saving'} />
      {status === 'saved' && <p className="ok">{t('admin.saved')}</p>}
      {status === 'error' && <p className="err">{t('admin.saveFailed')}</p>}
    </div>
  )
}

// The group's language: what every phone shows unless it picked its own (needs schema version 4).
function GroupLanguage({ group, onSaved }) {
  const options = optionsOf(group)
  const [status, setStatus] = useState('')
  const pick = async (lang) => {
    setStatus('saving')
    try {
      await api.saveOptions({ lang })
      forgetSchedule()
      await onSaved()
      setStatus('')
      setGroupLanguage(lang)
    } catch {
      setStatus('error')
    }
  }
  return (
    <div className="card stack">
      <div className="field">
        {t('admin.game.language')}
        <div className="chips">
          {['he', 'en'].map((l) => (
            <button type="button" key={l} lang={l} className={options.lang === l ? 'on' : ''} aria-pressed={options.lang === l}
              disabled={status === 'saving'} onClick={() => pick(l)}>{t(`admin.game.languages.${l}`)}</button>
          ))}
        </div>
      </div>
      <p className="muted small">{t('admin.game.languageHint')}</p>
      {status === 'error' && <p className="err">{t('admin.saveFailed')}</p>}
    </div>
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
      <h2>{t('admin.game.groupName')}</h2>
      <input className="input" value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setStatus('') }} aria-label={t('admin.game.groupName')} />
      {status === 'saved' && !changed && <p className="ok">{t('admin.saved')}</p>}
      {status === 'error' && <p className="err">{t('admin.saveFailed')}</p>}
      <button className="btn" disabled={!changed || status === 'saving'}>{t('common.save')}</button>
    </form>
  )
}
