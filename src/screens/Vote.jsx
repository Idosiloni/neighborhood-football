import { useEffect, useState } from 'react'
import { api } from '../data'
import RankList from '../components/RankList'
import { setMyCode } from '../lib/identity'
import PageHeader from '../components/PageHeader'
import { play } from '../lib/sound'

// Saved order first (minus anyone who left), then players he hasn't ranked yet.
function startingOrder(players, voter) {
  const others = players.filter((p) => p.active && p.id !== voter.id)
  const byId = new Map(others.map((p) => [p.id, p]))
  const saved = (voter.ranking ?? []).map((id) => byId.get(id)).filter(Boolean)
  const rest = others.filter((p) => !saved.includes(p))
  return [...saved, ...rest]
}

export default function Vote({ code }) {
  const [voter, setVoter] = useState()
  const [order, setOrder] = useState([])
  const [start, setStart] = useState([]) // the order he was shown, to notice a save without ranking
  const [newOnes, setNewOnes] = useState(0)
  const [status, setStatus] = useState('idle') // idle | dirty | saving | saved | error

  useEffect(() => {
    // The code comes first: the player list is the one of his group, read with his code.
    api.getVoter(code)
      .then(async (v) => {
        if (!v) return setVoter(null)
        setMyCode(code, v.group) // this phone now belongs to him: he can mark attendance and run matches
        const players = await api.listPlayers()
        setVoter(v)
        const list = startingOrder(players, v)
        setOrder(list)
        setStart(list.map((p) => p.id))
        if (v.ranking) setNewOnes(list.filter((p) => !v.ranking.includes(p.id)).length)
      })
      .catch(() => setStatus('error'))
  }, [code])

  if (status === 'error' && voter === undefined) return <Message text="אין חיבור כרגע. נסה שוב עוד רגע." />
  if (voter === undefined) return <Message text="טוען…" />
  if (voter === null) return <Message text="הקוד הזה לא נמצא. בקש ממנהל הקבוצה את הקישור האישי שלך." />

  const save = async () => {
    const untouched = order.length >= 3 && order.every((p, i) => p.id === start[i])
    if (untouched && !voter.ranking && !confirm('לא הזזת אף שחקן, הרשימה עדיין לפי א"ב. דירוג כזה לא נספר.\n\nלשמור בכל זאת?')) return
    setStatus('saving')
    try {
      const ids = order.map((p) => p.id)
      await api.submitBallot(code, ids)
      setVoter({ ...voter, ranking: ids })
      setStatus('saved')
      setNewOnes(0)
      play('win')
    } catch {
      setStatus('error')
    }
  }

  return (
    <main className="page vote">
      <PageHeader title={`היי ${voter.name}`} sub="מי הכי טוב במגרש? סדר מלמעלה למטה" back="#/me" />
      <p className="privacy">🔒 רק מנהלי הקבוצה רואים את הדירוג. את עצמך לא מדרגים. גוררים מ-⠿ או משתמשים בחצים.</p>
      {voter.ranking && (
        <p className="note">
          זה הדירוג ששמרת, הוא בתוקף. לא צריך לדרג שוב.
          {newOnes === 1 && ' נוסף שחקן חדש בסוף, אפשר למקם אותו.'}
          {newOnes > 1 && ` נוספו ${newOnes} שחקנים חדשים בסוף, אפשר למקם אותם.`}
        </p>
      )}

      <div className="rank-ends">
        <span>הכי טוב</span>
        <RankList
          players={order}
          onChange={(next) => {
            setOrder(next)
            setStatus('dirty')
            play('pop')
          }}
        />
        <span>הכי פחות</span>
      </div>

      <div className="save-bar">
        {status === 'saved' && <span className="ok">✓ נשמר!</span>}
        {status === 'error' && <span className="err">השמירה נכשלה, נסה שוב</span>}
        <button className="btn big" onClick={save} disabled={status === 'saving' || order.length === 0}>
          {status === 'saving' ? 'שומר…' : voter.ranking ? 'עדכן דירוג' : 'שמור דירוג'}
        </button>
      </div>
    </main>
  )
}

function Message({ text }) {
  return (
    <main className="page">
      <PageHeader title="דירוג שחקנים" back="#/" />
      <p className="center big-text">{text}</p>
    </main>
  )
}
