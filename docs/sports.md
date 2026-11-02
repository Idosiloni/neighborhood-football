# Adding another sport

Today every group plays football. The groundwork for more sports:

- `groups.sport` in the database (`'football'`; the check constraint `groups_sport_valid` lists the allowed ones).
- `src/sports/football.js` holds what is football-specific: positions, a new group's default rules,
  the choices offered when opening a group (players per team, minutes, goals), the words
  ("גול", "גוווול!", "בישול") and the profile emojis. Positions, rule defaults, the group settings
  form, the clock's extra time and the goal celebration read it from there (`src/sports/index.js`).

## What a new sport needs

1. **A sport file**, e.g. `src/sports/basketball.js`, with the same fields as `football.js`,
   added to `SPORTS` in `src/sports/index.js`.
2. **Pick the sport per group:** `sport` in `src/sports/index.js` is always football today. It
   should come from the open group (`sportOf(group.sport)`), and opening a group gets a sport step.
3. **Database:** add the sport to `groups_sport_valid`. Positions are checked by
   `players_positions_valid` and turned into `position`/`can_gk` by `private.sync_positions()`.
   Those are football's four positions, so a sport with other positions needs them generalized.
4. **Scoring, the honest part.** Matches work like small-sided football: a clock, "first to N",
   extra time, then golden goal (`src/lib/clock.js`, `nextState`). One goal = one row in `goals`.
   - Futsal, hockey, handball and similar fit as they are: change the words and the defaults.
   - Basketball scores 1, 2 or 3 points: `goals` needs a points value, and "first to 21" replaces
     "first to 3".
   - Volleyball plays sets and has no clock: `nextState` needs a sets mode (first to 25, win by 2,
     best of 3).
5. **Texts still written for football** in screens (e.g. "גול ל..." in the match screen,
   stats wording such as "מלך השערים" in `src/lib/stats.js`) should move into the sport's `words`
   as each new sport needs them.
