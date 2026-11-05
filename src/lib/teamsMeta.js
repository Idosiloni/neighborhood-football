import { t } from '../i18n/index.js'

// The two teams on the pitch. Names are read when shown, in the language of that moment.
export const TEAM = {
  a: {
    get name() {
      return t('common.team.a')
    },
    get short() {
      return t('common.team.aShort')
    },
    color: 'var(--team-a)',
  },
  b: {
    get name() {
      return t('common.team.b')
    },
    get short() {
      return t('common.team.bShort')
    },
    color: 'var(--team-b)',
  },
}
