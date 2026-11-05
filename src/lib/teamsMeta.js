import { t } from '../i18n/index.js'
import { teamColor } from './teamColors.js'

// The two teams on the pitch. Names follow the group's bib colors and are read when shown,
// in the language of that moment.
const side = (s) => ({
  get name() {
    return t(`common.colors.${teamColor(s)}.team`)
  },
  get short() {
    return t(`common.colors.${teamColor(s)}.short`)
  },
  color: `var(--team-${s})`,
})

export const TEAM = { a: side('a'), b: side('b') }
