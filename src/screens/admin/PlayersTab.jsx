import { useState } from 'react'
import { api } from '../../data'
import Avatar from '../../components/Avatar'
import { EMOJIS, fromPositions, positionsOf, positionsText } from '../../lib/positions'
import PositionPicker from '../../components/PositionPicker'
import { photoToDataUrl } from '../../lib/photo'
import { hasPhoto } from '../../lib/photos'
import { normalizeName, parseNames } from '../../lib/parseList'
import { isRTL, t } from '../../i18n'

const EMPTY = { name: '', emoji: '⚽', photo: null, positions: [], position: 'any', can_gk: false, active: true, is_admin: false }

export default function PlayersTab({ players, reload }) {
  const [editing, setEditing] = useState(null) // player object, or EMPTY for a new one
  const [bulk, setBulk] = useState(false)

  const active = players.filter((p) => p.active)
  const inactive = players.filter((p) => !p.active)

  if (editing) {
    return (
      <PlayerForm
        initial={editing}
        onCancel={() => setEditing(null)}
        onSaved={() => reload().then(() => setEditing(null))}
      />
    )
  }

  if (bulk) {
    return <BulkAdd players={players} onDone={() => reload().then(() => setBulk(false))} onCancel={() => setBulk(false)} />
  }

  return (
    <section className="stack">
      <div className="row">
        <button className="btn" onClick={() => setEditing(EMPTY)}>{t('admin.players.add')}</button>
        <button className="btn ghost" onClick={() => setBulk(true)}>{t('admin.players.addList')}</button>
      </div>
      <p className="muted">
        {t('admin.players.summary', {
          active: t('admin.players.active', { count: active.length }),
          claimed: t('admin.players.claimed', { count: active.filter((p) => p.claimed_at).length }),
          keepers: t('admin.players.keepers', { count: active.filter((p) => p.can_gk).length }),
        })}
      </p>
      <ul className="player-list">
        {active.map((p) => <PlayerRow key={p.id} player={p} onClick={() => setEditing(p)} />)}
      </ul>
      {inactive.length > 0 && (
        <>
          <h3>{t('admin.players.inactive')}</h3>
          <ul className="player-list dim">
            {inactive.map((p) => <PlayerRow key={p.id} player={p} onClick={() => setEditing(p)} />)}
          </ul>
        </>
      )}
    </section>
  )
}

function PlayerRow({ player, onClick }) {
  return (
    <li>
      <button className="player-row" onClick={onClick}>
        <Avatar player={player} />
        <span className="rank-name">
          {player.name}{player.is_admin && ' 👑'}
          <small>{[positionsText(player), player.nickname && t('admin.players.nickname', { nickname: player.nickname })].filter(Boolean).join(', ')}</small>
        </span>
        <span className={`reg${player.claimed_at ? ' on' : ''}`}>{player.claimed_at ? t('admin.players.joined') : t('admin.players.notJoined')}
        </span>
        <span className="chev">{isRTL() ? '‹' : '›'}</span>
      </button>
    </li>
  )
}

function PlayerForm({ initial, onCancel, onSaved }) {
  const [p, setP] = useState(() => ({ ...initial, positions: positionsOf(initial) }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (fields) => setP((prev) => ({ ...prev, ...fields }))

  const save = async (e) => {
    e.preventDefault()
    if (!p.name.trim()) return setError(t('admin.form.needName'))
    setBusy(true)
    try {
      const { id, name, emoji, photo, positions, active, is_admin } = p
      // The list has no photos: send it only if it was picked or removed here.
      await api.savePlayer({ id, name: name.trim(), emoji, ...(photo !== undefined && { photo }), ...fromPositions(positions), active, is_admin: Boolean(is_admin) })
      onSaved()
    } catch (err) {
      setError(err.message?.includes('last admin') ? t('admin.form.lastAdmin') : t('admin.saveFailed'))
      setBusy(false)
    }
  }

  // Someone took this name by mistake: free it for the join link and cut off whoever took it.
  const resetClaim = async () => {
    if (!confirm(t('admin.form.confirmReset', { name: p.name }))) return
    setBusy(true)
    await api.savePlayer({ id: p.id, claimed_at: null })
    await api.newCode(p.id)
    onSaved()
  }

  const remove = async () => {
    if (!confirm(t('admin.form.confirmDelete', { name: p.name }))) return
    setBusy(true)
    try {
      await api.deletePlayer(p.id)
      onSaved()
    } catch (err) {
      setError(err.message?.includes('last admin') ? t('admin.form.cantDeleteLastAdmin') : t('admin.form.deleteFailed'))
      setBusy(false)
    }
  }

  return (
    <form className="stack card" onSubmit={save}>
      <h2>{p.id ? t('admin.form.editTitle') : t('admin.form.newTitle')}</h2>

      <div className="photo-pick">
        <Avatar player={p} size={72} />
        <label className="btn small">
          {t('admin.form.photo')}
          <input type="file" accept="image/*" hidden onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) set({ photo: await photoToDataUrl(file) })
          }} />
        </label>
        {hasPhoto(p) && <button type="button" className="link-btn" onClick={() => set({ photo: null })}>{t('admin.form.removePhoto')}</button>}
      </div>

      <label className="field">
        {t('admin.form.name')}
        <input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} autoFocus={!p.id} />
      </label>

      {!hasPhoto(p) && (
        <div className="field">
          {t('admin.form.emoji')}
          <div className="emoji-grid">
            {EMOJIS.map((em) => (
              <button type="button" key={em} className={p.emoji === em ? 'on' : ''} onClick={() => set({ emoji: em })}>{em}</button>
            ))}
          </div>
        </div>
      )}

      <PositionPicker value={p.positions} onChange={(positions) => set({ positions })} />

      {p.id && (
        <label className="check">
          <input type="checkbox" checked={p.active} onChange={(e) => set({ active: e.target.checked })} />
          {t('admin.form.active')}
        </label>
      )}

      <label className="check">
        <input type="checkbox" checked={Boolean(p.is_admin)} onChange={(e) => set({ is_admin: e.target.checked })} />
        {t('admin.form.admin')}
      </label>

      {error && <p className="err">{error}</p>}
      <div className="row">
        <button className="btn" disabled={busy}>{t('common.save')}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>{t('common.cancel')}</button>
      </div>
      {p.id && p.claimed_at && (
        <button type="button" className="btn ghost" onClick={resetClaim} disabled={busy}>
          {t('admin.form.reset')}
        </button>
      )}
      {p.id && <button type="button" className="link-btn danger" onClick={remove} disabled={busy}>{t('admin.form.delete')}</button>}
    </form>
  )
}

// Paste many names at once (one per line). Each player can fill in their photo and position later.
function BulkAdd({ players, onDone, onCancel }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const existing = new Set(players.filter((p) => p.active).map((p) => normalizeName(p.name)))
  const names = parseNames(text)
  const toAdd = names.filter((n) => !existing.has(normalizeName(n)))
  const skipped = names.filter((n) => existing.has(normalizeName(n)))

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      for (const name of toAdd) await api.savePlayer({ name, emoji: '⚽', photo: null, position: 'any', can_gk: false, active: true })
      onDone()
    } catch {
      setError(t('admin.bulk.failed'))
      setBusy(false)
    }
  }

  return (
    <section className="card stack">
      <h2>{t('admin.bulk.title')}</h2>
      <p className="muted small">{t('admin.bulk.help')}</p>
      <textarea className="input textarea" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('admin.bulk.placeholder')} />
      {toAdd.length > 0 && <p className="ok">{t('admin.bulk.toAdd', { count: toAdd.length, names: toAdd.join(', ') })}</p>}
      {skipped.length > 0 && <p className="muted small">{t('admin.bulk.skipped', { names: skipped.join(', ') })}</p>}
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button className="btn" onClick={save} disabled={busy || toAdd.length === 0}>{busy ? t('admin.bulk.adding') : t('admin.bulk.add', { count: toAdd.length })}</button>
        <button className="btn ghost" onClick={onCancel} disabled={busy}>{t('common.cancel')}</button>
      </div>
    </section>
  )
}
