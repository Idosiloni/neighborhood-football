import { go } from '../lib/router'
import { setMyCode } from '../lib/identity'
import PageHeader from '../components/PageHeader'
import { CodeForm } from './Me'
import { t } from '../i18n'

export default function EnterCode() {
  return (
    <main className="page">
      <PageHeader title={t('onboarding.code.rankTitle')} back="#/" />
      <CodeForm onDone={(c, voter) => { setMyCode(c, voter.group); go(`/v/${c}`) }} />
    </main>
  )
}
