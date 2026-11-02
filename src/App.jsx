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
import Celebration from './components/Celebration'

// Screens that work before this phone is in any group.
const OPEN = new Set(['v', 'vote', 'join', 'new'])

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
function useSession(code) {
  const { data, error } = useLoad(async () => {
    if (!code) return { me: null }
    const me = await api.getVoter(code)
    if (me) setMyCode(code, me.group)
    return { me, invalid: !me }
  }, [code])
  // Offline: trust the saved code, the screens show their own "no connection".
  if (error && !data) return { me: undefined }
  return data
}

export default function App() {
  const [page, param] = useRoute()
  const code = getMyCode()
  const session = useSession(code)

  if (notConfigured) {
    return (
      <main className="page">
        <p className="center big-text">האפליקציה עוד לא מחוברת לשרת. חסרים המפתחות של Supabase בהגדרות של Vercel.</p>
      </main>
    )
  }

  if (session === undefined) return <main className="page"><p className="center muted">טוען…</p></main>

  const outside = session.me === null && !OPEN.has(page)
  // The vote screen has its own save bar at the bottom; outside a group there is nowhere to go;
  // the welcome after joining leads on by itself.
  const showNav = session.me !== null && !(page === 'v' && param) && page !== 'hello'

  return (
    <div className={`app${showNav ? ' with-nav' : ''}`}>
      {api.mode === 'demo' && <div className="demo-bar">מצב הדגמה: הנתונים נשמרים רק בטלפון הזה</div>}
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
