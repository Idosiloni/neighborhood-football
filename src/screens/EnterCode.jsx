import { go } from '../lib/router'
import { setMyCode } from '../lib/identity'
import PageHeader from '../components/PageHeader'
import { CodeForm } from './Me'

export default function EnterCode() {
  return (
    <main className="page">
      <PageHeader title="דירוג שחקנים" back="#/" />
      <CodeForm onDone={(c, voter) => { setMyCode(c, voter.group); go(`/v/${c}`) }} />
    </main>
  )
}
