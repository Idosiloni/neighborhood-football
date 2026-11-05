import { useState } from 'react'
import { api } from '../../data'
import { useLoad } from '../../lib/hooks'
import { t } from '../../i18n'

const ERRORS = { 'name taken': 'nameTaken', 'too many players': 'full', 'invalid listing': 'invalid' }
const friendly = (err) => t(`admin.listing.errors.${Object.entries(ERRORS).find(([k]) => err?.message?.includes(k))?.[1] ?? 'failed'}`)

// People who asked to join from "Find a group": let in (as a new player) or no.
export function RequestsCard({ onChange }) {
  const { data, reload } = useLoad(() => api.adminRequests(), [])
  const [names, setNames] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(null)
  if (!data?.length) return null

  const answer = async (r, ok) => {
    setBusy(r.id)
    setError('')
    try {
      await api.answerRequest(r.id, ok, names[r.id]?.trim() || null)
      await reload()
      onChange?.()
    } catch (err) {
      setError(friendly(err))
    }
    setBusy(null)
  }

  return (
    <section className="card stack">
      <strong>🙋 {t('admin.requests.title', { count: data.length })}</strong>
      <p className="muted small">{t('admin.requests.text')}</p>
      {data.map((r) => (
        <div key={r.id} className="request-admin">
          <input className="input" value={names[r.id] ?? r.name} aria-label={t('admin.requests.nameLabel')}
            onChange={(e) => setNames({ ...names, [r.id]: e.target.value.slice(0, 30) })} />
          {r.note && <p className="muted small" dir="auto">“{r.note}”</p>}
          <div className="row-btns">
            <button className="btn small" disabled={busy === r.id} onClick={() => answer(r, true)}>{t('admin.requests.yes')}</button>
            <button className="btn small ghost" disabled={busy === r.id} onClick={() => answer(r, false)}>{t('admin.requests.no')}</button>
          </div>
        </div>
      ))}
      {error && <p className="err">{error}</p>}
    </section>
  )
}

// "Find a group": whether strangers can find this group and ask to join, and what they see.
export function ListingCard({ group, reload }) {
  const [form, setForm] = useState({ city: group?.city ?? '', about: group?.about ?? '' })
  const [state, setState] = useState('idle') // idle | saving | saved | error
  if (!group) return null
  const looking = Boolean(group.looking_until && group.looking_until >= new Date().toISOString().slice(0, 10))

  const save = async (patch) => {
    setState('saving')
    try {
      await api.setListing(patch)
      await reload()
      setState('saved')
    } catch {
      setState('error')
    }
  }

  return (
    <section className="card stack">
      <strong>🔎 {t('admin.listing.title')}</strong>
      <p className="muted small">{t('admin.listing.text')}</p>
      <label className="check">
        <input type="checkbox" checked={Boolean(group.listed)} onChange={(e) => save({ listed: e.target.checked, city: form.city, about: form.about })} />
        {t('admin.listing.listed')}
      </label>
      {group.listed && (
        <>
          <label className="field">
            <span>{t('admin.listing.city')}</span>
            <input className="input" value={form.city} maxLength={40} placeholder={t('admin.listing.cityPlaceholder')} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label className="field">
            <span>{t('admin.listing.about')}</span>
            <textarea className="input" rows={2} value={form.about} maxLength={140} placeholder={t('admin.listing.aboutPlaceholder')} onChange={(e) => setForm({ ...form, about: e.target.value })} />
          </label>
          <button className="btn small ghost" onClick={() => save({ city: form.city, about: form.about })} disabled={state === 'saving'}>{t('common.save')}</button>
          <label className="check">
            <input type="checkbox" checked={looking} onChange={(e) => save({ looking: e.target.checked })} />
            {t('admin.listing.looking')}
          </label>
          <small className="muted">{t('admin.listing.lookingHint')}</small>
        </>
      )}
      {state === 'saved' && <small className="ok">{t('admin.listing.saved')}</small>}
      {state === 'error' && <p className="err small">{t('admin.listing.errors.failed')}</p>}
    </section>
  )
}
