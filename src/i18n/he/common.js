// Texts used all over the app. Gender-neutral Hebrew (docs/i18n.md).
export default {
  appName: 'כדורגל שכונה',
  loading: 'טוען…',
  back: 'חזרה',
  close: 'סגירה',
  save: 'שמירה',
  saving: 'שומר…',
  saved: 'נשמר ✓',
  cancel: 'ביטול',
  continue: 'המשך',
  edit: 'עריכה',
  delete: 'מחיקה',
  yes: 'כן',
  no: 'לא',
  offline: 'אין חיבור כרגע. אפשר לנסות שוב עוד רגע.',
  failed: 'משהו השתבש. אפשר לנסות שוב.',
  notConfigured: 'האפליקציה עוד לא מחוברת לשרת. חסרים המפתחות של Supabase בהגדרות של Vercel.',
  demoBar: 'מצב הדגמה: הנתונים נשמרים רק בטלפון הזה',

  // 0 = Sunday
  days: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
  // "יום שבת 7.11"
  dayLabel: 'יום {day} {date}',
  // "שבת 7.11, 9:30"
  gameLabel: '{day} {date}, {time}',

  // Bib colors: the team's name ("הכחולים") and the short form ("כחול") follow the color.
  colors: {
    blue: { team: 'הכחולים', short: 'כחול' },
    orange: { team: 'הכתומים', short: 'כתום' },
    red: { team: 'האדומים', short: 'אדום' },
    white: { team: 'הלבנים', short: 'לבן' },
    black: { team: 'השחורים', short: 'שחור' },
    yellow: { team: 'הצהובים', short: 'צהוב' },
    green: { team: 'הירוקים', short: 'ירוק' },
    purple: { team: 'הסגולים', short: 'סגול' },
  },

  language: 'שפה',
  languageAuto: 'אוטומטי',
}
