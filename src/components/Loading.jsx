import { useEffect, useState } from 'react'
import { t } from '../i18n'

// A ball rolling back and forth on a chalk line while something loads. Shown only after a
// moment, so fast loads don't flash it. index.html draws the same ball before the app starts.
// delay 0: right away (the app's first screen, which takes over from the ball in index.html).
export default function Loading({ text, page = false, delay = 200 }) {
  const [shown, setShown] = useState(delay === 0)
  useEffect(() => {
    const id = setTimeout(() => setShown(true), delay)
    return () => clearTimeout(id)
  }, [delay])
  const body = (
    <div className={`loading${shown ? ' shown' : ''}`} role="status">
      <div className="loading-track" aria-hidden="true">
        <Ball />
      </div>
      <span className={text ? 'muted small' : 'sr-only'}>{text ?? t('common.loading')}</span>
    </div>
  )
  return page ? <main className="page">{body}</main> : body
}

export function Ball({ size = 34 }) {
  return (
    <svg className="ball" width={size} height={size} viewBox="-50 -50 100 100">
      <defs>
        <clipPath id="ball-clip"><circle r="46" /></clipPath>
      </defs>
      <circle r="46" fill="#fff" />
      <g clipPath="url(#ball-clip)" fill="#11241a" stroke="#11241a" strokeWidth="3" strokeLinejoin="round">
        <polygon points="0,-15 14.3,-4.6 8.8,12.1 -8.8,12.1 -14.3,-4.6" />
        <polygon points="0,-30 -12.4,-39 -7.6,-53.5 7.6,-53.5 12.4,-39" />
        <polygon points="28.5,-9.3 33.3,-23.8 48.5,-23.8 53.3,-9.3 40.9,-0.3" />
        <polygon points="17.6,24.3 32.9,24.3 37.6,38.8 25.3,47.8 12.9,38.8" />
        <polygon points="-17.6,24.3 -12.9,38.8 -25.3,47.8 -37.6,38.8 -32.9,24.3" />
        <polygon points="-28.5,-9.3 -40.9,-0.3 -53.3,-9.3 -48.5,-23.8 -33.3,-23.8" />
        <path fill="none" d="M0,-15V-30M14.3,-4.6L28.5,-9.3M8.8,12.1L17.6,24.3M-8.8,12.1L-17.6,24.3M-14.3,-4.6L-28.5,-9.3" />
      </g>
      <circle r="46" fill="none" stroke="#11241a" strokeWidth="4" />
    </svg>
  )
}
