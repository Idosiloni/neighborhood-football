import { useState } from 'react'
import { api } from '../../data'
import Avatar from '../../components/Avatar'
import { EMOJIS, fromPositions, positionsOf, positionsText } from '../../lib/positions'
import PositionPicker from '../../components/PositionPicker'
import { photoToDataUrl } from '../../lib/photo'
import { hasPhoto } from '../../lib/photos'
import { normalizeName, parseNames } from '../../lib/parseList'

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
        <button className="btn" onClick={() => setEditing(EMPTY)}>＋ הוסף שחקן</button>
        <button className="btn ghost" onClick={() => setBulk(true)}>📋 הוסף רשימה</button>
      </div>
      <p className="muted">
        {active.length} שחקנים פעילים, {active.filter((p) => p.claimed_at).length} כבר נרשמו בעצמם, {active.filter((p) => p.can_gk).length} יכולים לשמור
      </p>
      <ul className="player-list">
        {active.map((p) => <PlayerRow key={p.id} player={p} onClick={() => setEditing(p)} />)}
      </ul>
      {inactive.length > 0 && (
        <>
          <h3>לא פעילים</h3>
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
          <small>{[positionsText(player), player.nickname && `״${player.nickname}״`].filter(Boolean).join(', ')}</small>
        </span>
        <span className={`reg${player.claimed_at ? ' on' : ''}`}>{player.claimed_at ? '✓ נרשם' : 'טרם נרשם'}
        </span>
        <span className="chev">‹</span>
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
    if (!p.name.trim()) return setError('צריך שם')
    setBusy(true)
    try {
      const { id, name, emoji, photo, positions, active, is_admin } = p
      // The list has no photos: send it only if it was picked or removed here.
      await api.savePlayer({ id, name: name.trim(), emoji, ...(photo !== undefined && { photo }), ...fromPositions(positions), active, is_admin: Boolean(is_admin) })
      onSaved()
    } catch (err) {
      setError(err.message?.includes('last admin') ? 'לקבוצה חייב להיות לפחות מנהל פעיל אחד. קודם הפוך שחקן אחר למנהל.' : 'השמירה נכשלה')
      setBusy(false)
    }
  }

  // Someone took this name by mistake: free it for the join link and cut off whoever took it.
  const resetClaim = async () => {
    if (!confirm(`לאפס את הרישום של ${p.name}? השם יחזור לרשימה בקישור ההצטרפות, והקישור האישי הישן שלו יפסיק לעבוד.`)) return
    setBusy(true)
    await api.savePlayer({ id: p.id, claimed_at: null })
    await api.newCode(p.id)
    onSaved()
  }

  const remove = async () => {
    if (!confirm(`למחוק את ${p.name} לגמרי? גם הדירוג שהוא נתן יימחק. אם הוא פשוט הפסיק לבוא, עדיף לסמן "לא פעיל".`)) return
    setBusy(true)
    try {
      await api.deletePlayer(p.id)
      onSaved()
    } catch (err) {
      setError(err.message?.includes('last admin') ? 'אי אפשר למחוק את המנהל האחרון של הקבוצה.' : 'המחיקה נכשלה')
      setBusy(false)
    }
  }

  return (
    <form className="stack card" onSubmit={save}>
      <h2>{p.id ? 'עריכת שחקן' : 'שחקן חדש'}</h2>

      <div className="photo-pick">
        <Avatar player={p} size={72} />
        <label className="btn small">
          📷 תמונה
          <input type="file" accept="image/*" hidden onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) set({ photo: await photoToDataUrl(file) })
          }} />
        </label>
        {hasPhoto(p) && <button type="button" className="link-btn" onClick={() => set({ photo: null })}>הסר תמונה</button>}
      </div>

      <label className="field">
        שם
        <input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} autoFocus={!p.id} />
      </label>

      {!hasPhoto(p) && (
        <div className="field">
          אימוג'י
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
          פעיל (משחק אצלנו)
        </label>
      )}

      <label className="check">
        <input type="checkbox" checked={Boolean(p.is_admin)} onChange={(e) => set({ is_admin: e.target.checked })} />
        מנהל קבוצה 👑 (רואה את הדירוג ומנהל שחקנים)
      </label>

      {error && <p className="err">{error}</p>}
      <div className="row">
        <button className="btn" disabled={busy}>שמור</button>
        <button type="button" className="btn ghost" onClick={onCancel}>ביטול</button>
      </div>
      {p.id && p.claimed_at && (
        <button type="button" className="btn ghost" onClick={resetClaim} disabled={busy}>
          אפס רישום (מישהו בחר את השם הזה בטעות)
        </button>
      )}
      {p.id && <button type="button" className="link-btn danger" onClick={remove} disabled={busy}>מחק שחקן</button>}
    </form>
  )
}

// Paste many names at once (one per line). Each player can fill in his photo and position later.
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
      setError('חלק מהשחקנים לא נשמרו. בדוק את הרשימה ונסה שוב.')
      setBusy(false)
    }
  }

  return (
    <section className="card stack">
      <h2>הוספת רשימת שחקנים</h2>
      <p className="muted small">אפשר להדביק את הרשימה מוואטסאפ כמו שהיא (עם המספרים והכותרת). כל שחקן ישלים תמונה ועמדה בעצמו דרך הקישור האישי שלו.</p>
      <textarea className="input textarea" rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={'יוסי\nאבי\nמשה'} />
      {toAdd.length > 0 && <p className="ok">יתווספו {toAdd.length}: {toAdd.join(', ')}</p>}
      {skipped.length > 0 && <p className="muted small">כבר ברשימה: {skipped.join(', ')}</p>}
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button className="btn" onClick={save} disabled={busy || toAdd.length === 0}>{busy ? 'מוסיף…' : `הוסף ${toAdd.length || ''}`}</button>
        <button className="btn ghost" onClick={onCancel} disabled={busy}>ביטול</button>
      </div>
    </section>
  )
}
