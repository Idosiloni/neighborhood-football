import { useState } from 'react'
import { currentGroup, myGroups, openGroup } from '../lib/identity'
import Sheet from './Sheet'
import Icon from './Icon'

// A button (the open group's name, or label); tap to switch to another group on this phone,
// open a new one or join one.
export default function GroupSwitcher({ label, className = '' }) {
  const [open, setOpen] = useState(false)
  const current = currentGroup()
  const groups = myGroups()
  const title = label ?? current?.name ?? 'הקבוצה'

  return (
    <>
      <button className={`group-switch ${className}`} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {title} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <Sheet title="הקבוצות שלי" onClose={() => setOpen(false)}>
          <div className="stack">
            {groups.map((g) => (
              <button
                key={g.code}
                className={`player-row${g.code === current?.code ? ' on' : ''}`}
                onClick={() => (g.code === current?.code ? setOpen(false) : openGroup(g.code))}
              >
                <span className="group-dot">⚽</span>
                <span className="rank-name">{g.name}</span>
                {g.code === current?.code ? <Icon name="check" size={18} /> : <span className="chev">‹</span>}
              </button>
            ))}
            <a className="btn ghost" href="#/join" onClick={() => setOpen(false)}>📨 הצטרפות לקבוצה נוספת</a>
            <a className="btn ghost" href="#/new" onClick={() => setOpen(false)}>🆕 פתיחת קבוצה חדשה</a>
          </div>
        </Sheet>
      )}
    </>
  )
}
