import Icon from './Icon'

const ITEMS = [
  { href: '#/', page: '', icon: 'home', label: 'בית' },
  { href: '#/tonight', page: 'tonight', icon: 'pitch', label: 'הערב' },
  { href: '#/stats', page: 'stats', icon: 'chart', label: 'סטטיסטיקה' },
  { href: '#/me', page: 'me', icon: 'user', label: 'אני' },
]
const SECTION = { match: 'tonight', next: 'tonight', card: 'stats', vote: 'me', v: 'me' }

export default function BottomNav({ page = '' }) {
  const current = SECTION[page] ?? page
  return (
    <nav className="bottom-nav" aria-label="ניווט ראשי">
      {ITEMS.map((it) => (
        <a key={it.page} href={it.href} className={current === it.page ? 'on' : ''} aria-current={current === it.page ? 'page' : undefined}>
          <Icon name={it.icon} />
          <span>{it.label}</span>
        </a>
      ))}
    </nav>
  )
}
