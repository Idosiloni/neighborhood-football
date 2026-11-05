import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { Ball } from './Loading'

// A card that went up a color: its back spins in, light bursts, it turns over to show the new card.
// Tap anywhere to close (after the turn). Just money-free fun: no packs, no chance.
export default function CardReveal({ tier, mine, name, onDone, children }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setOpen(true), 1100)
    return () => clearTimeout(id)
  }, [])
  useEffect(() => {
    const key = (e) => e.key === 'Escape' && onDone()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [onDone])

  const tierName = t(`stats.tiers.${tier}`)
  return (
    <div className={`reveal ${tier}${open ? ' open' : ''}`} role="dialog" aria-modal="true" aria-label={t('stats.reveal.label')} onClick={() => open && onDone()}>
      <div className="reveal-rays" aria-hidden="true" />
      <div className="reveal-flip">
        <div className="reveal-back" aria-hidden="true"><Ball size={84} /></div>
        <div className="reveal-front">{children}</div>
      </div>
      <p className="reveal-title" aria-live="polite">
        {open && (mine ? t('stats.reveal.mine', { tier: tierName }) : t('stats.reveal.other', { name, tier: tierName }))}
      </p>
      {open && <p className="reveal-tap">{t('stats.reveal.tap')}</p>}
    </div>
  )
}
