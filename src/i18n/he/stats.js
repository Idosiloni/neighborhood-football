// Texts of the stats area (owner: see docs/i18n.md). Same keys in he/ and en/.
// Gender-neutral Hebrew: awards, traits and taglines fit anyone (docs/i18n.md).
export default {
  title: 'סטטיסטיקה',
  sub: 'פרסים, טבלאות וכרטיסים אישיים',
  matchesSoFar: { one: 'משחק אחד עד היום', two: 'שני משחקים עד היום', other: '{count} משחקים עד היום' },
  games: { one: 'משחק אחד', two: 'שני משחקים', other: '{count} משחקים' },
  empty: {
    title: 'עוד אין משחקים שהסתיימו',
    text: 'אחרי המשחק הראשון יופיעו כאן כתר השערים, הצמד הזהב ועוד.',
  },
  boardsTitle: 'טבלאות',
  boards: {
    goals: 'שערים',
    assists: 'בישולים',
    wins: 'ניצחונות',
    rate: '% ניצחון',
  },

  // The six numbers on the card.
  attrs: {
    games: 'משחקים',
    winRate: '% ניצחון',
    mvp: 'MVP',
    goals: 'שערים',
    assists: 'בישולים',
    conceded: 'ספיגות למשחק',
    bestStreak: 'שיא רצף',
    attendance: 'נוכחות',
    wins: 'ניצחונות',
  },

  awards: {
    mvp: { title: 'מגנט ה-MVP', text: { one: 'MVP פעם אחת', two: 'פעמיים MVP', other: '{count} פעמים MVP' } },
    scorer: { title: 'כתר השערים' },
    assists: { title: 'מטבח הבישולים' },
    hot: { title: 'על האש', text: { one: 'ניצחון אחד ברצף עכשיו', two: 'שני ניצחונות ברצף עכשיו', other: '{count} ניצחונות ברצף עכשיו' } },
    lucky: { title: 'הקמע', text: '{pct}% ניצחונות' },
    machine: { title: 'מכונת ניצחונות', text: 'שיא: {count} ברצף' },
    duo: {
      title: 'הצמד הזהב',
      text: { one: 'ניצחון אחד מתוך {games} יחד', two: 'שני ניצחונות מתוך {games} יחד', other: '{count} ניצחונות מתוך {games} יחד' },
    },
    combo: { title: 'הקומבו', text: { one: 'גול אחד ביחד', two: 'שני גולים ביחד', other: '{count} גולים ביחד' } },
    wall: { title: 'הקיר', text: '{n} ספיגות למשחק' },
    iron: { title: 'ריאות של ברזל' },
    unlucky: {
      title: 'בלי מזל',
      text: { one: 'הפסד אחד (היום הגדול עוד יבוא)', two: 'שני הפסדים (היום הגדול עוד יבוא)', other: '{count} הפסדים (היום הגדול עוד יבוא)' },
    },
  },

  // Fun badges on the card.
  traits: {
    fresh: 'פנים חדשות',
    gloves: 'ידיים של דבק',
    sniper: 'עין של צלף',
    passes: 'מסירות קסם',
    defScorer: 'הגנה עם תיאבון לגולים',
    attStrike: 'התקפה בשביתה',
    train: 'רכבת ניצחונות',
    charm: 'קמע',
    optimist: 'אופטימיות נצחית',
    regular: 'אף ערב לא מתפספס',
    saver: 'הצלות בשער',
  },

  // One funny line per player, by position. Keep 3 per position in every language (same index per player).
  taglines: {
    att: ['שער באופק? בעיטה. לפעמים אפילו פגיעה.', 'מסירה? לא מכירים את המילה.', 'כתובת קבועה: הרחבה. שכר הדירה משולם בגולים.'],
    mid: ['המוח של הקבוצה. לפחות לפי הגרסה הרשמית.', 'הכי הרבה ריצה, הכי הרבה תלונות.', 'כדורים מתחלקים כאן כמו חלה בשישי.'],
    def: ['פה לא עוברים. לא תמיד בדרך חוקית.', 'הכדור עובר, מי שמאחוריו לא.', 'כל ניצחון מתחיל מאחור.'],
    gk: ['יחסים מיוחדים עם הקורה.', 'שכיבה על הדשא, ברמה מקצועית.', 'צעקות על ההגנה. ובצדק.'],
    any: ['בכל עמדה במגרש. בעיקר בעמדה של אחרים.', 'שימו בכל עמדה, זה יסתדר.', 'כל העמדות, אפס ויכוחים.'],
  },

  card: {
    title: 'כרטיס אישי',
    notFound: 'הכרטיס לא נמצא.',
    nickname: '״{name}״',
    share: '📤 שיתוף הכרטיס',
    preparing: 'מכינים תמונה…',
    shareText: 'הכרטיס של {name} ⚽',
    ratingLater: 'הדירוג על הכרטיס מופיע אחרי 3 משחקים. הוא מחושב רק מתוצאות המשחקים.',
    awardsTitle: 'התארים',
  },

  // Ranking players (Vote screen and the list in it).
  vote: {
    title: 'דירוג שחקנים',
    hi: 'היי {name}',
    sub: 'מי הכי טוב במגרש? סדרו מלמעלה למטה',
    notFound: 'הקוד הזה לא נמצא. אפשר לבקש ממנהלי הקבוצה את הקישור האישי.',
    privacy: '🔒 רק מנהלי הקבוצה רואים את הדירוג, ואין דירוג עצמי. גוררים מ-⠿ או משתמשים בחצים.',
    untouched: 'אף שם לא זז, הרשימה עדיין לפי א"ב. דירוג כזה לא נספר.\n\nלשמור בכל זאת?',
    savedNote: 'זה הדירוג השמור, והוא בתוקף. לא צריך לדרג שוב.',
    newOnes: {
      one: 'יש שם חדש בסוף הרשימה, אפשר למקם אותו.',
      two: 'יש שני שמות חדשים בסוף הרשימה, אפשר למקם אותם.',
      other: 'יש {count} שמות חדשים בסוף הרשימה, אפשר למקם אותם.',
    },
    best: 'הכי טובים',
    worst: 'הכי פחות',
    saved: '✓ נשמר!',
    saveFailed: 'השמירה נכשלה, אפשר לנסות שוב',
    update: 'עדכון הדירוג',
    save: 'שמירת הדירוג',
    moveUp: 'הזזת {name} למעלה',
    moveDown: 'הזזת {name} למטה',
    drag: 'גרירת {name}',
  },

  // The admin's ranking tab.
  ranking: {
    loadFailed: 'לא הצלחנו לטעון את הדירוג',
    rankedForReal: '{n} מתוך {total} דירגו באמת',
    notYet: 'עוד לא דירגו: {names}',
    lazy: '⚠️ שמרו בלי להזיז אף שם (הדירוג שלהם לא נספר): {names}',
    noVotes: 'עוד אין הצבעות. שלחו קישורים בלשונית "קישורים".',
    votes: { one: 'דירוג אחד', two: 'שני דירוגים', other: '{count} דירוגים' },
    avgRank: ', מקום ממוצע {avg}',
    scoreNote: 'הציון: 100 = במקום הראשון אצל כולם, 0 = במקום האחרון אצל כולם. דירוג עצמי לא נספר.',
    ballotsShow: 'מי דירג ואיך? (כמה שמות זזו בכל דירוג)',
    ballotsHide: 'הסתרה',
    ballotNone: 'עוד אין דירוג',
    ballotRanked: 'דורגו {count}',
    ballotLazy: '⚠️ אף שם לא זז',
    ballotMoved: '{moved} מתוך {ranked} זזו',
    ballotsNote: 'רק המספרים: הדירוגים עצמם נשארים סודיים, גם ממנהלי הקבוצה. דירוג שאף שם לא זז בו נשאר לפי א"ב, ולכן לא נספר. אפשר לבקש לדרג שוב.',
  },
  // Seasons, the season table, form, attendance and milestones (version 7).
  season: {
    current: 'העונה',
    all: 'כל הזמנים',
    earlier: 'לפני העונות',
    justStarted: 'העונה רק התחילה',
    justStartedText: 'אחרי המשחק הראשון יופיעו כאן הטבלה והתארים.',
    lastSeason: 'לעונה הקודמת',
  },
  table: {
    title: 'הטבלה',
    name: 'שם',
    games: 'מש׳',
    record: 'נ-ת-ה',
    goals: '⚽',
    assists: '🎩',
    sortBy: 'מיון לפי',
    minGames: 'אחוז ניצחונות רק אחרי {count} משחקים',
  },
  form: {
    title: 'פורמה',
    W: 'נ',
    D: 'ת',
    L: 'ה',
    names: { W: 'ניצחון', D: 'תיקו', L: 'הפסד' },
    latest: 'האחרון',
    aria: 'חמשת המשחקים האחרונים: {list}',
  },
  cardMore: {
    seasonLine: 'העונה: {games}, {wins} ניצחונות, {goals} גולים',
    attendance: 'הגעה: {pct}% מימי המשחק ({played} מתוך {since})',
    nightStreak: { one: 'רצף: יום משחק אחד ברציפות', two: 'רצף: יומיים ברציפות', other: 'רצף: {count} ימי משחק ברציפות' },
    record: 'נ-ת-ה: {w}-{d}-{l}',
    partners: 'הכי מנצחים יחד',
    partnerLine: '{wins} ניצחונות ב-{games} משחקים יחד',
    opponents: 'ראש בראש',
    opponentLine: 'נ-ת-ה: {w}-{d}-{l}',
  },
  milestones: {
    games: '{count} משחקים',
    goals: '{count} גולים',
    mvp: '{count} פעמים MVP',
    nightStreak: '{count} ימי משחק ברצף',
  },
  // Category ratings ("advanced") and the full card (version 8).
  cats: {
    spd: 'מהירות', sht: 'בעיטה', pas: 'מסירה', tec: 'כדרור', def: 'הגנה', fit: 'כושר',
    gk_ref: 'רפלקסים', gk_han: 'תפיסה', gk_pos: 'מיקום', gk_dis: 'הוצאה',
    long: {
      spd: 'מהירות', sht: 'בעיטה וסיום', pas: 'מסירה', tec: 'שליטה וכדרור', def: 'הגנה', fit: 'כושר ומאמץ',
      gk_ref: 'עצירות ורפלקסים', gk_han: 'תפיסה', gk_pos: 'מיקום ויציאות', gk_dis: 'משחק רגל והוצאה',
    },
    goalkeeping: 'שוערות',
  },
  rate: {
    title: 'דירוג לפי קטגוריות',
    sub: 'יחסית לקבוצה שלנו, בסוד',
    scale: { 1: 'נקודת חולשה', 2: 'מתחת לממוצע אצלנו', 3: 'בערך הממוצע אצלנו', 4: 'חזק', 5: 'מהטובים כאן' },
    howTo: 'בחרו קטגוריה, ולכל שם ציון 1–5. לחיצה נוספת מבטלת. את מי שלא מכירים מדלגים.',
    progress: '{n} מתוך {total} דורגו ב{attr}',
    secret: 'הדירוגים האישיים סודיים מכולם. הכרטיסים מתעדכנים פעם בשבוע, וקטגוריה מופיעה רק אחרי 3 דירוגים לפחות.',
    needLink: 'כדי לדרג צריך להיכנס עם הקישור האישי.',
    failed: 'לא נשמר. אפשר לנסות שוב.',
    cta: 'דירוג לפי קטגוריות',
    ctaText: 'הדירוגים של כולם בונים כרטיס מלא לכל שחקן ושחקנית',
  },
  fullCard: {
    basedOn: 'לפי {range} דירוגים · מתעדכן פעם בשבוע',
    missing: 'עוד אין מספיק דירוגים לכל הקטגוריות. בינתיים הדירוג על הכרטיס הוא מהמשחקים.',
  },

  // The card's color, and how far the next one is.
  tiers: {
    new: 'חדש',
    bronze: 'ארד',
    silver: 'כסף',
    gold: 'זהב',
    toNext: { one: 'עוד נקודה אחת ל{tier}', two: 'עוד 2 נקודות ל{tier}', other: 'עוד {count} נקודות ל{tier}' },
    top: 'הכי גבוה שיש ✨',
  },

  // A card that went up a color.
  reveal: {
    label: 'הכרטיס עלה',
    mine: 'הכרטיס שלך עלה ל{tier}!',
    other: 'הכרטיס של {name} עלה ל{tier}!',
    tap: 'לחיצה לסגירה',
    homeTitle: 'הכרטיס שלך עלה ל{tier} ✨',
    homeText: 'לחיצה לחשיפה',
  },

  // Team of the Week: the best of the last game day.
  week: {
    title: 'נבחרת השבוע',
    badge: '⭐ נבחרת השבוע',
    sub: 'הכי טובים של {day}',
    star: 'שחקן השבוע',
    points: 'ניצחון 3 · תיקו 1 · שער 2',
    pointsAssists: ' · בישול 1',
    pointsMvp: ' · MVP 2',
    wins: { one: 'ניצחון אחד', two: '2 ניצחונות', other: '{count} ניצחונות' },
    pts: { one: 'נקודה אחת', two: '2 נקודות', other: '{count} נקודות' },
    youAreIn: 'יש לך מקום בנבחרת השבוע! ⭐',
    youAreInText: 'הכרטיס שלך לבש את צבעי הנבחרת עד יום המשחק הבא',
    share: '📤 שיתוף הנבחרת',
    shareText: 'נבחרת השבוע ⚽',
    empty: 'אחרי יום משחק יופיעו כאן הכי טובים שלו.',
  },
}
