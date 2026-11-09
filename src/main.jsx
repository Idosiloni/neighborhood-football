import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LazyMotion, MotionConfig } from 'motion/react'
import App from './App'
import { registerSW } from 'virtual:pwa-register'
import './styles.css'
import { unlockSound } from './lib/sound'
import { applyTextSize } from './lib/textSize'
import { applyTheme } from './lib/theme'
import { followGroupLink } from './lib/identity'

applyTextSize()
applyTheme()
followGroupLink()

// A new version takes over and reloads the page by itself (no stale app after an update).
registerSW({ immediate: true })

// Phones play sound only after a tap: every tap makes sure it is allowed.
window.addEventListener('pointerdown', unlockSound, { passive: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Motion follows the phone's "reduce motion" setting. */}
    <MotionConfig reducedMotion="user">
      <LazyMotion features={() => import('./lib/motionFeatures.js').then((m) => m.default)} strict>
        <App />
      </LazyMotion>
    </MotionConfig>
  </StrictMode>,
)
