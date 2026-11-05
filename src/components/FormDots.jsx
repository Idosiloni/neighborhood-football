import { t } from '../i18n'

// The last five results as dots, oldest first in the markup: in Hebrew (right to left) the newest
// ends up on the left, in English on the right. Each dot has its letter (not color alone) and the
// newest has a ring.
export default function FormDots({ form, size = 'small' }) {
  if (!form?.length) return null
  const list = form.map((r) => t(`stats.form.names.${r}`)).join(', ')
  return (
    <span className={`form-dots ${size}`} role="img" aria-label={t('stats.form.aria', { list })}>
      {form.map((r, i) => (
        <span key={i} className={`form-dot ${r}${i === form.length - 1 ? ' latest' : ''}`} aria-hidden="true"
          title={i === form.length - 1 ? `${t(`stats.form.names.${r}`)} (${t('stats.form.latest')})` : t(`stats.form.names.${r}`)}>
          {t(`stats.form.${r}`)}
        </span>
      ))}
    </span>
  )
}
