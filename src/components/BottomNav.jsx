import Icon from './Icon'
import { t } from '../i18n'

// name: the text in home.nav
const ITEMS = [
  { href: '#/', page: '', icon: 'home', name: 'home' },
  { href: '#/tonight', page: 'tonight', icon: 'pitch', name: 'tonight' },
  { href: '#/stats', page: 'stats', icon: 'chart', name: 'stats' },
  { href: '#/me', page: 'me', icon: 'user', name: 'me' },
]
const SECTION = { match: 'tonight', next: 'tonight', card: 'stats', week: 'stats', vote: 'me', v: 'me' }

export default function BottomNav({ page = '' }) {
  const current = SECTION[page] ?? page
  return (
    <nav className="bottom-nav" aria-label={t('home.nav.label')}>
      {ITEMS.map((it) => (
        <a key={it.page} href={it.href} className={current === it.page ? 'on' : ''} aria-current={current === it.page ? 'page' : undefined}>
          <Icon name={it.icon} />
          <span>{t(`home.nav.${it.name}`)}</span>
        </a>
      ))}
    </nav>
  )
}
