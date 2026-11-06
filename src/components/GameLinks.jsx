import { addToCalendar, mapsUrl } from '../lib/calendar'
import { language, t } from '../i18n'

// Where the game is, with directions, and "add to calendar" (every week). Under the next game.
export default function GameLinks({ day, schedule, groupName }) {
  const place = [schedule.venue, schedule.city].filter(Boolean).join(', ')
  const add = () => addToCalendar({
    day,
    kickoff: schedule.kickoff,
    title: t('home.calendar.title', { group: groupName || t('common.appName') }),
    venue: place,
    details: t('home.calendar.details'),
    url: `${window.location.origin}${window.location.pathname}`,
  })
  return (
    <div className="game-links">
      {schedule.venue && (
        <a className="game-link" href={mapsUrl(place, language())} target="_blank" rel="noreferrer" aria-label={t('home.calendar.directions', { place: schedule.venue })}>
          <span aria-hidden="true">📍</span> <span className="game-link-text" dir="auto">{schedule.venue}</span>
        </a>
      )}
      <button type="button" className="game-link" onClick={add}>
        <span aria-hidden="true">📅</span> {t('home.calendar.add')}
      </button>
    </div>
  )
}
