import { useRoute } from './lib/router'
import { api, notConfigured } from './data'
import { useLoad } from './lib/hooks'
import { getMyCode, setMyCode } from './lib/identity'
import BottomNav from './components/BottomNav'
import Home from './screens/Home'
import Vote from './screens/Vote'
import EnterCode from './screens/EnterCode'
import Admin from './screens/Admin'
import Tonight from './screens/Tonight'
import Match from './screens/Match'
import NextMatch from './screens/NextMatch'
import Stats from './screens/Stats'
import PlayerCard from './screens/PlayerCard'
import Me from './screens/Me'
import Join from './screens/Join'
import Place from './screens/Place'
import Welcome from './screens/Welcome'
import CreateGroup from './screens/CreateGroup'
import Hello from './screens/Hello'
import QuickSignup from './screens/QuickSignup'
import RateCategories from './screens/RateCategories'
import Celebration from './components/Celebration'
import { setGroupLanguage, t, useLocale } from './i18n'
import { optionsOf } from './lib/options'
import { applyTeamColors } from './lib/teamColors'
import Loading from './components/Loading'

// Screens that work before this phone is in any group.
const OPEN = new Set(['v', 'vote', 'join', 'new', 'in'])

function Screen({ page, param }) {
  switch (page) {
    case 'v':
      return param ? <Vote code={param} /> : <EnterCode />
    case 'vote':
      return <EnterCode />
    case 'admin':
      return <Admin />
    case 'tonight':
      return <Tonight />
    case 'match':
      return <Match id={param} />
    case 'next':
      return <NextMatch matchId={param} />
    case 'stats':
      return <Stats />
    case 'card':
      return <PlayerCard id={param} />
    case 'me':
      return <Me edit={param === 'edit'} />
    case 'place':
      return <Place />
    case 'rate':
      return <RateCategories />
    case 'in':
      return <QuickSignup joinCode={param} />
    case 'join':
      return <Join joinCode={param} />
    case 'new':
      return <CreateGroup />
    case 'hello':
      return <Hello />
    default:
      return <Home />
  }
}

// Which group this phone is in now. Also remembers the group of a code saved before groups existed.
// page: on a join link the screen shows the joined group's language, so the open group's isn't applied.
function useSession(code, page) {
  const { data, error } = useLoad(async () => {
    if (!code) return { me: null }
    const me = await api.getVoter(code)
    if (me) {
      setMyCode(code, me.group)
      // The group's language, for a phone that hasn't picked one (doesn't hold up the start).
      // A database without options (before schema version 4) only had Hebrew groups.
      api.getGroup().then((g) => {
        if (!g) return
        applyTeamColors(g.options)
        if (page !== 'join' && page !== 'in') setGroupLanguage('options' in g ? optionsOf(g).lang : 'he')
      }, () => {})
    }
    return { me, invalid: !me }
  }, [code])
  // Offline: trust the saved code, the screens show their own "no connection".
  if (error && !data) return { me: undefined }
  return data
}

// A language change remounts everything, so every screen reads its texts again.
export default function App() {
  const locale = useLocale()
  return <AppBody key={locale} />
}

function AppBody() {
  const [page, param] = useRoute()
  const code = getMyCode()
  const session = useSession(code, page)

  if (notConfigured) {
    return (
      <main className="page">
        <p className="center big-text">{t('common.notConfigured')}</p>
      </main>
    )
  }

  if (session === undefined) return <Loading page delay={0} />

  const outside = session.me === null && !OPEN.has(page)
  // The vote screen has its own save bar at the bottom; outside a group there is nowhere to go;
  // the welcome after joining leads on by itself.
  const showNav = session.me !== null && !(page === 'v' && param) && page !== 'hello'

  return (
    <div className={`app${showNav ? ' with-nav' : ''}`}>
      {api.mode === 'demo' && <div className="demo-bar">{t('common.demoBar')}</div>}
      {outside ? (
        <Welcome invalid={session.invalid} />
      ) : (
        <Screen key={`${page}/${param ?? ''}/${code ?? ''}`} page={page} param={param} />
      )}
      {showNav && <BottomNav page={page ?? ''} />}
      <Celebration />
    </div>
  )
}
