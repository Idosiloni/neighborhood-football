import { isKeeperOnly, POSITIONS } from '../lib/positions'

// Tap every position he plays. value / onChange: a list like ['def', 'mid'].
export default function PositionPicker({ value, onChange }) {
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])

  return (
    <div className="field">
      איפה אתה משחק? (אפשר לבחור כמה)
      <div className="chips">
        {POSITIONS.map((pos) => (
          <button type="button" key={pos.id} className={value.includes(pos.id) ? 'on' : ''} aria-pressed={value.includes(pos.id)} onClick={() => toggle(pos.id)}>
            {pos.label}
          </button>
        ))}
      </div>
      <small className="muted">
        {value.length === 0
          ? 'לא בחרת = משחק בכל מקום חוץ מהשער.'
          : isKeeperOnly(value)
            ? 'רק שוער = שוער קבוע: משחק רק בשער, אחד לכל קבוצה, ואחרי הפסד נשאר.'
            : value.includes('gk')
              ? 'יכול גם להיכנס לשער כשצריך.'
              : 'משחק בכל מקום וגם בשער? סמן את כולן.'}
      </small>
    </div>
  )
}
