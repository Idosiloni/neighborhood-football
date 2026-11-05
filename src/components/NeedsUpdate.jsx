import { t } from '../i18n'

// Shown on the new screens until whoever runs the server applies the updated schema.sql in Supabase.
export default function NeedsUpdate() {
  return (
    <div className="card empty">
      <div className="empty-emoji">🛠️</div>
      <strong>{t('home.needsUpdate.title')}</strong>
      <p className="muted">{t('home.needsUpdate.text')}</p>
    </div>
  )
}
