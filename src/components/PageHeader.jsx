import { t } from '../i18n'
import Icon from './Icon'

export default function PageHeader({ title, sub, back, action }) {
  return (
    <header className="page-header">
      {back && (
        <a className="icon-btn" href={back} aria-label={t('common.back')}><Icon name="back" size={18} /></a>
      )}
      <div className="page-header-text">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </header>
  )
}
