import { useState } from 'react'
import Avatar from './Avatar'
import Icon from './Icon'
import { EMOJIS, fromPositions, positionsOf } from '../lib/positions'
import PositionPicker from './PositionPicker'
import { photoToDataUrl } from '../lib/photo'
import { hasPhoto } from '../lib/photos'
import { t } from '../i18n'

// What a player fills in about himself: photo (camera or gallery), nickname, positions.
// withName: the join screen also asks for his name.
// photo stays undefined until he picks or removes one: saving then leaves his photo as it is.
export default function ProfileForm({ initial, withName = false, compact = false, submitLabel, onSubmit }) {
  const [p, setP] = useState(() => ({ ...initial, positions: positionsOf(initial) }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (fields) => setP((prev) => ({ ...prev, ...fields }))

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      set({ photo: await photoToDataUrl(file) })
    } catch {
      setError(t('onboarding.profile.photoError'))
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (withName && !p.name?.trim()) return setError(t('onboarding.profile.nameRequired'))
    setBusy(true)
    setError('')
    try {
      await onSubmit({ ...p, ...fromPositions(p.positions) })
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className={`profile-photo${hasPhoto(p) ? ' has-photo' : ''}`}>
        <Avatar player={p} size={132} />
        <div className="row">
          <label className="btn small ghost">
            <Icon name="camera" size={18} /> {t('onboarding.profile.camera')}
            <input type="file" accept="image/*" capture="user" hidden onChange={pickPhoto} />
          </label>
          <label className="btn small ghost">
            <Icon name="image" size={18} /> {t('onboarding.profile.gallery')}
            <input type="file" accept="image/*" hidden onChange={pickPhoto} />
          </label>
        </div>
        {hasPhoto(p) && <button type="button" className="link-btn" onClick={() => set({ photo: null })}>{t('onboarding.profile.removePhoto')}</button>}
      </div>

      {withName && (
        <label className="field">
          {t('onboarding.profile.name')}
          <input className="input" value={p.name ?? ''} onChange={(e) => set({ name: e.target.value })} maxLength={30} autoComplete="given-name" />
        </label>
      )}

      {compact ? (
        <details className="more-profile">
          <summary>{t('onboarding.profile.more')}</summary>
          <div className="stack">
      <label className="field">
              {t('onboarding.profile.nickname')}
              <input className="input" value={p.nickname ?? ''} onChange={(e) => set({ nickname: e.target.value })} maxLength={24} placeholder={t('onboarding.profile.nicknamePlaceholder')} />
            </label>

            {!hasPhoto(p) && (
              <div className="field">
                {t('onboarding.profile.emoji')}
                <div className="emoji-grid emoji-scroll">
                  {EMOJIS.map((em) => (
                    <button type="button" key={em} className={p.emoji === em ? 'on' : ''} onClick={() => set({ emoji: em })}>{em}</button>
                  ))}
                </div>
              </div>
            )}

          </div>
        </details>
      ) : (
        <>
      <label className="field">
        {t('onboarding.profile.nickname')}
        <input className="input" value={p.nickname ?? ''} onChange={(e) => set({ nickname: e.target.value })} maxLength={24} placeholder={t('onboarding.profile.nicknamePlaceholder')} />
      </label>

      {!hasPhoto(p) && (
        <div className="field">
          {t('onboarding.profile.emoji')}
          <div className="emoji-grid emoji-scroll">
            {EMOJIS.map((em) => (
              <button type="button" key={em} className={p.emoji === em ? 'on' : ''} onClick={() => set({ emoji: em })}>{em}</button>
            ))}
          </div>
        </div>
      )}

        </>
      )}

      <PositionPicker value={p.positions} onChange={(positions) => set({ positions })} />

      {error && <p className="err">{error}</p>}
      <button className="btn big" disabled={busy}>{busy ? t('common.saving') : submitLabel}</button>
    </form>
  )
}
