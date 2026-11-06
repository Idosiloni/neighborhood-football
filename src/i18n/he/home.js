// Texts of the home area: home screen, sign-up card, bottom bar, "updating" notice.
// Gender-neutral Hebrew (docs/i18n.md). Same keys in he/ and en/.
export default {
  heroTitle: ['כדורגל', 'שכונה'],
  hello: 'היי {name}, מוכנים למשחק?',
  tagline: 'קבוצות הוגנות, בלי ויכוחים',
  myGroups: 'הקבוצות שלי',

  ready: {
    title: '🎉 הקבוצה מוכנה! עכשיו מזמינים את החברים',
    text: 'שולחים את הקישור בקבוצת הוואטסאפ. כולם נרשמים עם שם ותמונה, ומדרגים את השאר. אפשר גם להוסיף רשימת שמות בעצמך, במסך הניהול.',
    addMyself: '➕ הוספת שחקנים בעצמי',
  },

  liveNow: 'משחק {num} חי עכשיו',
  mvpAsk: '👑 מי ה-MVP של משחק {num}?',
  mvpText: 'כל מי ששיחק בו מצביע. לוקח שנייה.',
  newPlayers: { one: '🆕 הצטרפות חדשה: {name}', two: '🆕 נוספו שני שחקנים חדשים', other: '🆕 נוספו {count} שחקנים חדשים' },
  newPlayersText: { one: 'איפה {name} אצלך בדירוג? לחיצה אחת.', other: 'איפה הם אצלך בדירוג? זה מהיר.' },
  rankTitle: '🗳️ השחקנים מחכים לדירוג שלך',
  rankText: 'לוקח דקה, ועושים את זה פעם אחת. ככה הקבוצות יוצאות שוות.',

  tonight: 'הערב',
  // "8 הגיעו, 2 משחקים"
  tonightNow: '{arrived}, {games}',
  arrived: { one: '1 כבר כאן', other: '{count} הגיעו' },
  games: { one: 'משחק אחד', two: 'שני משחקים', other: '{count} משחקים' },
  tonightEmpty: 'מי מגיע? חלוקה לקבוצות',
  stats: 'סטטיסטיקה',
  statsText: 'פרסים וכרטיסים',
  ranking: 'דירוג שחקנים',
  rankingUpdate: 'עדכון הדירוג',
  rankingSecret: 'סודי, רק המנהלים רואים',
  lastGame: 'המשחק האחרון',
  ourPlayers: 'השחקנים שלנו',
  registered: '{count} מתוך {total} נרשמו',
  podium: 'על הפודיום',
  manage: 'ניהול הקבוצה',

  calendar: {
    add: 'ליומן (כל שבוע)',
    title: '⚽ {group}',
    details: 'המשחק השבועי. ההרשמה באפליקציה:',
    directions: 'ניווט אל {place}',
  },
  signup: {
    ask: 'שליחת "מי בפנים?" בוואטסאפ',
    askHeader: '⚽ מי בפנים? {when}',
    askSoFar: { one: 'כבר אחד ברשימה', two: 'כבר שניים ברשימה', other: 'כבר {count} ברשימה' },
    askQuick: 'לחצו על השם שלכם: {link}',
    askApp: 'נרשמים באפליקציה: {link}',
    today: 'היום',
    thisWeek: 'השבוע',
    // "אין משחק בשבת 7.11"
    noGame: 'אין משחק ב{day} {date} 😴',
    seeYou: 'נתראה בשבוע הבא.',
    nextToday: 'המשחק היום',
    next: 'המשחק הקרוב',
    empty: 'הרשימה עוד ריקה. מי נרשם ראשון?',
    waiting: 'ממתינים',
    in: 'אני בפנים ✋',
    out: 'לא אוכל לבוא',
    joinFirst: 'כדי להירשם למשחק, הצטרפו לאפליקציה',
    copy: 'העתקת הרשימה לוואטסאפ',
    copied: '✓ הרשימה הועתקה',
    // first line of the list copied to WhatsApp: "שבת 7.11 9:30"
    listHeader: '{day} {date} {time}',
    countdown: 'זמן עד המשחק',
    units: { days: 'ימים', hours: 'שעות', minutes: 'דקות', seconds: 'שניות' },
  },

  nav: {
    label: 'ניווט ראשי',
    home: 'בית',
    tonight: 'הערב',
    stats: 'סטטיסטיקה',
    me: 'אני',
  },

  needsUpdate: {
    title: 'עוד רגע…',
    text: 'האפליקציה מתעדכנת כרגע. נסו שוב בעוד כמה דקות.',
  },

  // Notifications on the phone.
  push: {
    title: 'התראות לטלפון',
    text: 'תזכורת יום לפני המשחק (כמה רשומים וכמה חסרים), והודעה כשמישהו חדש מצטרף כדי לדרג. אפשר לכבות בכל רגע.',
    toggle: 'התראות מהקבוצה הזאת',
    install: 'באייפון התראות עובדות רק מהאפליקציה שעל המסך הראשי: שיתוף ← "הוספה למסך הבית", ואז מפעילים כאן.',
    blocked: 'ההתראות חסומות בהגדרות של הטלפון. אפשר להפעיל אותן שם, בהגדרות האתר או האפליקציה.',
    askTitle: 'תזכורת יום לפני המשחק?',
    askText: 'הודעה קצרה בטלפון: כמה רשומים וכמה חסרים. בלי ספאם.',
    turnOn: 'להפעלה',
    requests: { one: '🙋 בקשת הצטרפות אחת מחכה', two: '🙋 2 בקשות הצטרפות מחכות', other: '🙋 {count} בקשות הצטרפות מחכות' },
  },
}
