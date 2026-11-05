import { isKeeperOnly, POSITIONS } from '../lib/positions'
import { t } from '../i18n'

// Tap every position he plays. value / onChange: a list like ['def', 'mid'].
export default function PositionPicker({ value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  return (
    <div className="field">
      {t('onboarding.positions.title')}
      <div className="chips">
        {POSITIONS.map((pos) => (
          <button type="button" key={pos.id} className={value.includes(pos.id) ? 'on' : ''} aria-pressed={value.includes(pos.id)} onClick={() => toggle(pos.id)}>
            {pos.label}
          </button>
        ))}
      </div>
      <small className="muted">
        {value.length === 0
          ? t('onboarding.positions.none')
          : isKeeperOnly(value)
            ? t('onboarding.positions.keeperOnly')
            : value.includes('gk')
              ? t('onboarding.positions.alsoGoal')
              : t('onboarding.positions.everywhere')}
      </small>
    </div>
  )
}
