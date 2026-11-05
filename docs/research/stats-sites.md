# What pro football sites show, and what a weekly pickup app should borrow

Research for Neighborhood Football (כדורגל שכונה), a free Hebrew PWA for weekly pickup games. English is coming.
Date: November 2026.

## How to read this report

- **[fetched]**: I opened the page and read it.
- **[snippet]**: the claim comes only from search-result summaries. Treat it as likely, not confirmed.
- **[general knowledge]**: well-known conventions I didn't verify with a source this session. Check them in the apps before you rely on them.
- Some sites couldn't be read. Transfermarkt blocked fetching, and FBref returned HTTP 403. I found nothing reliable on OneFootball's match page, BBC Sport's current fan ratings, ESPN lineups/Gamecast, Sport5/ONE match pages, the official Ligat Ha'Al (IPFL) site, or an Israeli app for amateur leagues. Those gaps are marked below. I didn't fill them from memory.

---

## 1. What the app already has

I read `src/lib/stats.js` and `supabase/schema.sql` first so the recommendations build on the existing app.

| Already computed | Where it shows today |
|---|---|
| Games, wins, losses, win % (shown after 3 games) | Stats tables, player card |
| Goals, assists, goals and assists per game | Stats tables, card |
| Current win streak, best win streak | Awards "בוער" and "מכונת ניצחונות", card |
| Keeper games and goals conceded per game (if `position === 'gk'`) | Card, award "wall" |
| MVP count (most-voted player of each **match**) | Card, award "כוכב המשחקים" |
| **Duos**: win % of two players on the same team | Award "הצמד הזהב" |
| **Combos**: assist-to-scorer pairs | Award "הקומבו" |
| `overall` 45–99 rating from wins, goals, assists and games (after 3 games) | Card |
| `nights` + `attendance` (with `arrived_at`) tables | **Not used by stats yet** |

The data model affects which ideas fit:

- **There are no draws.** A match counts only when it has a `winner` (first to N goals, then golden goal). The pro table columns P W **D** L GF GA GD Pts don't fit as they are.
- **One night = several short matches with rotating teams** (`matches.night_id`, `num`). "Games played", "form" and "streak" can be counted per match or per night. The schema already separates the two (`nights` and `matches`).
- **There is no season concept.** All stats are all-time.
- **The keeper is a fixed position on the player**, not who was in goal in that match.

---

## 2. What the pro sites do

### 2.1 Match pages

**Timeline / events**
- ESPN match pages have a *Match Timeline* (kickoff to halftime to full time with key minutes), a minute-by-minute *Match Commentary*, and *Match Stats* (possession, shots on goal, shot attempts, yellow cards, corners, saves). [snippet] https://www.espn.com/soccer/match/_/gameId/490210/tottenham-hotspur-kitchee
- Our League (an amateur app) has a *Live Match* mode with a match clock and an **event timeline** of goals, assists and **goalkeeper changes**, plus custom events such as injuries. [fetched] https://apps.apple.com/us/app/id1493907118
- The general pro pattern is a vertical timeline split by halftime, with icons for goal, assist, card and sub. [general knowledge]

**Lineups on a pitch**
- FotMob shows starting lineups and formations before kickoff, and "top players" per team in match facts. [snippet; FotMob release notes] https://apkmirror.com/apk/fotmob-as/fotmob-live-soccer-scores/fotmob-live-soccer-scores-164-10580-20230324-release
- FotMob and SofaScore draw the XI on a pitch graphic with each player's rating badge on their shirt. [general knowledge]

**Momentum graphs**
- SofaScore's *Attack Momentum* is a live graph that rises toward the team on the attack. Its inputs are passes into dangerous areas, shots, free kicks, corners and counter-attacks. It stays on the page after the match as a summary of how the game went. [fetched] https://www.sofascore.com/news/how-sofascores-attack-momentum-changed-sport-analysis
- FotMob added a momentum graph in 2023. It is powered by Opta data alongside xG and shot maps. [snippet] https://apkmirror.com/apk/fotmob-as/fotmob-live-soccer-scores/fotmob-live-soccer-scores-164-10580-20230324-release

**Player match ratings**
- SofaScore: algorithmic. Every player **starts at 6.5**. The first ratings appear after **10 minutes**, each player's rating is updated about **60 times per match**, and a perfect 10 is rare (about 1 in 3,000 performances, by SofaScore's own claim). [fetched] https://www.sofascore.com/news/sofascore-rating
- SofaScore's help page: a machine-learning model over hundreds of data points, in five action categories (shooting, passing, dribbling, defending, goalkeeping). There is a **match rating** and a **season rating** (the average). The highest season average gets "Player of the Season", shown as an in-app badge in 120 leagues. [fetched] https://sofascore.helpscoutdocs.com/article/50-sofascore-statistical-ratings-explained
- WhoScored starts at 6.0 and **also counts the team's result**. SofaScore is more individual. [snippet] https://footyroom.co/articles/whoscored-and-sofascore-the-main-resources-for-player-ratings-669e5b1cf6cd5044b86e6193
- FotMob's rating uses 300+ data points (Opta). [snippet]
- Colors: SofaScore and FotMob put a colored badge on every rating (green/blue for high, orange/red for low). The rating page I fetched shows its scale only as an image, so I couldn't confirm the exact bands. [general knowledge]

### 2.2 Player pages

**FotMob player page** (the most detailed look in this research) [fetched] https://www.fotmob.com/players/626890

The sections, from top to bottom:
1. **Header**: name, club, follow button.
2. **Bio chips**: height, shirt number, preferred foot, country, position (primary + others, drawn on a mini-pitch), market value, contract end.
3. **Player traits radar**: percentiles against players in the same position. Touches, shot attempts, goals, chances created, aerial duels won, defensive contributions.
4. **Season summary tiles**: **Goals, Assists, Started, Matches, Minutes, Rating**, yellow cards, red cards.
5. **Match-by-match table** with team and league filters (minutes, position, goals, assists, cards, rating).
6. **Recent matches = form**: cards with date, opponent, score, minutes and the **rating badge** for each game.
7. **Heatmap + shot map**: xG, on target %, filters.
8. **Season performance**, grouped by Shooting / Passing / Possession / Defending / Discipline. **Clean sheets** sit under Defending.
9. **Career table**: club, season, matches, goals. Then **trophies**.

The pattern is a small set of headline numbers (6–8 tiles) first, then form, then depth, grouped and collapsed.

**FBref**: "Scouting reports" give each stat **per 90 minutes and as a percentile** against players in the same position, over the last 365 days or a season, with a minimum minutes cutoff. The main player page shows a 20-stat summary, and there is a list of "similar players". The FBref pages returned 403, so this comes from search summaries. [snippet] https://www.sports-reference.com/blog/2021/02/fbref-scouting-reports-and-similar-players-launched/ and https://fbref.com/en/about/scouting-reports-explained

**Transfermarkt**: blocked. Known for market-value history and a career/performance table (appearances, goals, assists, minutes, cards, minutes per goal). [general knowledge, not verified]

**How "form" is shown**
- Last 5 results as colored W/D/L chips (green, grey, red). [snippet] https://www.renderfoot.com/standings/premier-league
- A rating badge on each recent match (FotMob). [fetched]

### 2.3 League / table pages

- **Standard columns**: P (played), W, D, L, GF, GA, GD, Pts (3/1/0), plus **Form (last 5)**. GD is the usual tiebreaker. [snippet] https://www.soccernews.com/soccer-stats/english-premier-league/league-table/ and https://www.renderfoot.com/standings/premier-league
- **Form tables** with points per game (PPG), split home/away. [snippet] https://footystats.org/england/premier-league/form-table
- **Leaders lists**: top scorers ("מלך השערים") and top assists ("מלך הבישולים") are standard on Israeli sites. [snippet] https://sports.walla.co.il/stats?leagueId=2913&stat=4
- **Team of the Week**: FotMob's algorithm picks the best-rated XI in a formation each matchday. It is a TOTW tab in the league. FotMob also publishes a Team of the Season. [snippet] https://www.fotmob.com/topnews/19039-premier-league-team-week-matchday-25
- **Player of the Month**: the A-League shortlists the **top 10 by FotMob rating**, then fans vote. This is a good hybrid of stats and votes. [snippet] https://aleagues.com.au/news/nicolas-milanovic-player-of-the-month-october-november-aleague-men-western-sydney-wanderers
- The BBC has had a fan-voted "team of the season" built from fan ratings after each game (a 2022 report; current status unverified). [snippet] https://www.empireofthekop.com/2022/01/12/three-liverpool-players-have-made-the-bbc-team-of-the-season-so-far-according-to-fan-votes/

### 2.4 Engagement mechanics

- **Premier League Player of the Match (official site and app).** The shortlist is the **top 5 players per club by FPL bonus points**. A "Vote Now" button opens **right at the final whistle**, voting **closes 15 minutes later**, and the winner is shown on the fixture page and on social media. The explainer doesn't mention vote percentages. [fetched] https://www.premierleague.com/en/player-of-the-match/potm-explained
- **Locker Lounge (amateur).** **Anonymous** MOTM voting opens automatically after each game and ends with a **"gold reveal" screen**. It also has seasonal leaderboards (goals, assists, clean sheets), one-tap RSVP, push notifications for upcoming games, and an AI team picker. A planned feature is voice stat entry on Apple Watch. [fetched] https://www.producthunt.com/p/locker-lounge-pickup-soccer-sorted/locker-lounge-pickup-soccer-sorted
- **Our League (amateur).** Enter **just the final score**, then optionally add scorers and assists afterwards. It tracks attendance, form, **streaks**, GK goals conceded and clean sheet %, **played-with / played-against**, head-to-head comparisons, a league table, **shareable player cards**, match reports and "season stories". [fetched] https://apps.apple.com/us/app/id1493907118
- **Sentr (amateur).** Fantasy-style **points per player per game**, broken down by month. Shareable result graphic (score + lineup + points), comments and **"claps"** on matches, win ratio. [fetched] https://apps.apple.com/app/sentr-football/id1567810192
- **Footsapp.** Enter goals and assists live, live POTM vote, team leaderboard. [snippet] https://mwm.ai/apps/footsapp/1469878266
- **Footy Addicts.** Players and the organiser rate each other after the game for trust. [snippet] https://blog.footyaddicts.com/what-is-footy-addicts/
- **Spond.** Attendance statistics over a season. [snippet] https://www.spond.com/news-and-blog/free-football-apps/
- An unnamed App Store listing tracks **no-shows** as "reliability". [snippet] https://apps.apple.com/app/id1023658328
- **Predictions / polls.** Fan "who will win" polls are common (OneFootball lets users predict results). [snippet, unverified on OneFootball's own pages] https://alternativeto.net/software/onefootball/about
- **Notifications.** For ONE (Israel), live goal and event push alerts are central to the app. [snippet] https://www.pushwoosh.com/he/blog/one/
- **Badges.** SofaScore gives a Player of the Season badge. [fetched, see 2.1]

### 2.5 Israeli landscape

- **ONE.co.il app**: live match reports, results, news, paid live-match broadcasts, and push alerts that matter most to users. I couldn't confirm player ratings or a fan POTM vote. [snippet] https://apps.apple.com/il/app/one-co-il/id337064110
- **Sport5 / ערוץ הספורט app**: broadcasts, highlights, tables, results. A Sport5 poll showed **percent per player per position** (a fan-vote team). [snippet] https://apps.apple.com/app/id439572682
- **Walla Sports**: league tables, **top scorers and top assists** pages. Walla also runs a yearly project where readers rate every Ligat Ha'Al player 1–10. [snippet] https://sports.walla.co.il/stats?leagueId=2913&stat=3
- **365scores**: an Israeli-built global scores app (about 20M users). [snippet]
- **Official Ligat Ha'Al / IPFL site and IFA**: not found in search. Not verified.
- **An Israeli app for amateur or pickup leagues**: **I found none.** The closest is "Organize Football Games", which supports Hebrew (balanced teams, chat, RSVP). [snippet] https://apps.apple.com/us/app/id1531354603 This suggests a Hebrew-first pickup app with real stats has little direct competition.

### 2.6 UX patterns for dense stats on a phone

From the FotMob page I fetched, plus well-known conventions [general knowledge]:
- **Headline tiles first** (6–8 big numbers), with depth in grouped, collapsible sections (FotMob: Shooting, Passing, and so on).
- **Tabs** on match pages (Facts / Lineup / Stats / Table) and on player pages.
- **Color-coded rating badges** on every player in every list and lineup.
- **Form chips** (W/D/L dots) that can be read at a glance.
- **Mirrored bars** for team-vs-team stats (two bars from the center).
- **Percentile bars or radar** compare players to peers instead of showing raw numbers alone (FBref, FotMob traits).
- **Filters** (season / competition / team) instead of more columns.
- **Rank lists** with avatar, name and one big number, and a "see all" link.

---

## 3. Recommendations for a weekly pickup app

### 3.1 What friends can realistically record

The rule: **one person, one tap per event, during the game; everything else is computed.**

| Stat | Effort | Status |
|---|---|---|
| Attendance per night | 0 taps (from signups and arrival) | **Have the data, not shown in stats.** Show it. |
| Match winner | 1 tap | Have |
| Goals (scorer) | 1 tap per goal | Have |
| Assists | Optional 2nd tap on a goal | Have. Keep it optional. Our League lets you add it after the game. |
| Wins, win %, streaks | Computed | Have |
| MVP | Each player votes once on their phone | Have |
| Duos / combos | Computed | **Have. This is unique, so lead with it.** |
| Goals conceded / clean sheets (GK) | Computed, **only correct if we know who was in goal** | Partly. See 3.5. |
| Own goals | 1 tap (scorer = "own goal") | New, cheap. Our League has it. |
| Punctuality (arrived before kickoff) | 0 taps (`arrived_at` already exists) | New, cheap, fun ("first to arrive"). |
| No-shows (signed up but didn't come) | 0 taps (signup vs attendance) | New. Show it to admins only, or as gentle fun. |

**Avoid** (each needs too much entry, or a tracker): minutes played, shots, passes, xG, tackles, saves, cards, subs, heatmaps, momentum, any algorithmic 1–10 rating built from events.

### 3.2 Season concepts that fit pickup

- **A player table, not a team table.** Teams change every week, so the table ranks players.
- **There are no draws in this app's format**, so don't copy P W D L GD Pts. Suggested columns:
  **Nights · Matches · W · L · Win % · Goals · Assists · MVP** with a **form strip** (last 5 match results as W/L dots).
  - Sort by win % with a **minimum number of matches** (the code already uses 3 for win % and 5 for the "lucky" award). Or let the user sort by any column.
  - Add draws only if a group plays timed games that can end level.
  - A "points" column (3 per win) is optional and only makes sense if everyone plays about the same number of matches. Win % or points per match (PPG) is fairer for people who skip weeks.
- **What to count per match and what per night.** My recommendation:
  - **Per match**: W/L, form dots, win streak, goals, assists. These are the real units of the game, and they give enough sample size.
  - **Per night**: attendance, attendance streak ("came 8 weeks in a row"), "player of the night", and the share image. A night is what people remember and come back for.
  - Show both on the card: "12 nights · 41 matches".
- **Seasons.** Add a season (by default a calendar quarter or half-year, set by the admin) with an "all-time" toggle. Seasons give a reset, a winner, and a reason to return. Stats today are all-time only.
- **Season awards** (the existing awards, per season): top scorer, top assister, most MVPs, best win % (minimum matches), best duo, best combo, **iron man** (most nights attended), best keeper (only if a real GK, see 3.5).
- **Player of the Month**: A-League style hybrid. Shortlist the top 3–5 by goals + assists + MVPs, then the group votes. It is cheap and feels "official".

### 3.3 Prioritized list

**Must (high value, little or no extra data entry)**
1. **Season player table** with W/L form dots, minimum-games rule, and sort by column. *(New view on existing data)*
2. **Attendance in stats**: nights attended, attendance %, attendance streak. *(Data exists, show it)*
3. **"Night summary" share image** after each night: results of each match, top scorer, MVP, best duo. *(New. Highest viral value. Card image code already exists in `cardImage.js`.)*
4. **MVP vote with a time window and a reveal.** Open it at the final whistle and close it after a fixed time (the PL uses 15 minutes; for a pickup group, maybe "until midnight"). Then show a **reveal screen** (Locker Lounge's gold reveal). Keep it anonymous. Consider **one MVP per night** in addition to, or instead of, per match. Five MVP polls in one night is a lot. *(Change to an existing feature)*
5. **Match timeline** on the match/night page: goal events with minute, scorer and assist, grouped by match. *(The data exists: `goals.at_ms`)*
6. **Form on the player card**: the last 5 results as dots, plus the current streak. *(Have the data)*

**Nice**
7. **Season awards and a "hall of fame"** with past season winners.
8. **Badges / milestones**: 10, 25, 50 nights; hat-trick; first goal; 5 wins in a row; 10 MVPs. Badges are cheap, computed and shareable.
9. **Player of the Month** (shortlist + vote).
10. **Head-to-head / "played with"**: your record with and against each friend. This extends duos (Our League has it).
11. **Push notifications** (PWA web push): signup opens, "2 spots left", vote is open, results are posted. Notifications drive engagement for ONE and Locker Lounge.
12. **Pre-match prediction poll** ("who wins match 1?"), shown with percentages. Low effort, fun before kickoff.
13. **Team of the Week / "Night XI"**: probably skip. With 10–15 players a night it's almost everyone. "Player of the night" plus "duo of the night" fits better.

**Later**
14. Monthly points history / trend chart (like Sentr).
15. A computed match rating (see 3.4), only if the group wants it.
16. Per-player "goals by minute" or "comebacks", only for fans of the details.
17. Positions/roles drawn on the card's mini-pitch (FotMob style). The app already has multi-position players.

### 3.4 Ratings: peer ranking and public numbers

- The pro sites' 1–10 ratings are **algorithmic** and built on hundreds of events we won't collect. Copying the look (a colored badge on a number) without the data would mislead.
- Keep the **peer ranking private** (as the code already does: "Never uses the peer ranking"). In a friend group, a public ranking can feel like a judgment of the person.
- If you want a public number, derive it from results only, as `overall()` already does (wins, goals, assists, games). Borrow from SofaScore:
  - a **neutral starting value** (SofaScore starts at 6.5),
  - **no rating before a minimum sample** (`overall` already waits for 3 games; SofaScore waits 10 minutes),
  - **show the formula** in a small "how it's calculated" sheet so friends trust it.
- Consider the "result also counts" choice openly. WhoScored counts the team's result and SofaScore doesn't. In pickup, wins dominate `overall` (up to 35 of the 63 variable points: win % 35, goals 14, assists 9, games 5). That's fair, but say so.

### 3.5 Keeper stats

`isKeeper` comes from the player's fixed position. If the group **rotates who goes in goal**, goals conceded and clean sheets go to the wrong player. Choose one:
- show GK stats only for groups with a **regular keeper** (an admin setting), or
- add an optional "who's in goal" tap per match (Our League logs goalkeeper changes).

A "clean sheet" in first-to-N matches means the losing team scored 0. That is rare and meaningful, so it's worth a badge.

### 3.6 UX notes for this app

- **Form direction in RTL.** The common convention is "newest on the right". In Hebrew that reverses the meaning. Add an explicit "latest" marker (a ring, or a "אחרון" label) on the newest dot, and test it in both Hebrew and English.
- **Headline tiles, then depth.** The card already shows six numbers. In the full profile, put details in collapsible groups (Results / Scoring / Keeper / Attendance).
- **One big number per leaderboard row**, with avatar and name. Use tabs for Goals / Assists / MVP / Win % / Nights instead of one wide table.
- **Color**: green = W, red/grey = L. Keep a colored text label too, not color alone (accessibility).
- **Minimum-games note** shown inline ("min. 5 matches") so missing players don't look like a bug.
- **Mirrored bars** on the night summary for team A vs team B, if team stats are shown.

### 3.7 What to avoid

- Any stat that needs a dedicated scorekeeper the whole match: minutes, shots, saves, cards, subs, possession.
- **Momentum graphs and heatmaps**: they need event or tracking data. A light alternative is a "goal flow" strip from goal timestamps (which side scored when).
- Fake precision: decimals, ratings shown before enough games, 0–99 attributes such as "pace" that nobody measured. The code already says "no made-up 0-99 scale" for card attributes.
- Public negative leaderboards (most losses, most no-shows). Keep those for admins or frame them as jokes the group opts into.
- A team standings table. Teams don't persist.

---

## 4. Terminology for a US audience

[general knowledge. Check against your target users.]

| UK / international | US preferred | Note |
|---|---|---|
| football | **soccer** | In the US "football" means the gridiron game. Use "soccer" in the store listing and onboarding. Inside a pickup group, "pickup soccer" is the standard phrase. [The soccer/football split is sourced: https://www.mentalfloss.com/sports/why-do-americans-call-it-soccer-instead-football-world-cup] |
| pitch | **field** | |
| fixtures | **schedule / games** | "Next game" rather than "next fixture" |
| match | **game** | "Match" is understood but "game" is more natural |
| clean sheet | **shutout** | |
| draw | **tie** | |
| nil ("2–nil") | **zero / "nothing"** | |
| table / league table | **standings** | |
| boots | **cleats** | |
| kit / strip | **jersey / uniform** | |
| keeper | **goalie / goalkeeper** | |
| man of the match / player of the match | **player of the game / MVP** | MVP is familiar to US users. Use it in both languages. |
| top scorer | **leading scorer / Golden Boot** | |
| assist, hat-trick | same | |
| season | same | |
| kick-off | **kickoff** (one word) | |

---

## 5. Sources

Fetched (read directly):
- https://www.premierleague.com/en/player-of-the-match/potm-explained
- https://sofascore.helpscoutdocs.com/article/50-sofascore-statistical-ratings-explained
- https://www.sofascore.com/news/sofascore-rating
- https://www.sofascore.com/news/how-sofascores-attack-momentum-changed-sport-analysis
- https://www.fotmob.com/players/626890
- https://www.producthunt.com/p/locker-lounge-pickup-soccer-sorted/locker-lounge-pickup-soccer-sorted
- https://apps.apple.com/us/app/id1493907118 (Our League)
- https://apps.apple.com/app/sentr-football/id1567810192 (Sentr)

Search results only:
- https://footyroom.co/articles/whoscored-and-sofascore-the-main-resources-for-player-ratings-669e5b1cf6cd5044b86e6193
- https://apkmirror.com/apk/fotmob-as/fotmob-live-soccer-scores/fotmob-live-soccer-scores-164-10580-20230324-release
- https://www.fotmob.com/topnews/19039-premier-league-team-week-matchday-25
- https://aleagues.com.au/news/nicolas-milanovic-player-of-the-month-october-november-aleague-men-western-sydney-wanderers
- https://www.sports-reference.com/blog/2021/02/fbref-scouting-reports-and-similar-players-launched/
- https://fbref.com/en/about/scouting-reports-explained (returned 403 when fetched)
- https://www.espn.com/soccer/match/_/gameId/490210/tottenham-hotspur-kitchee
- https://www.renderfoot.com/standings/premier-league
- https://www.soccernews.com/soccer-stats/english-premier-league/league-table/
- https://footystats.org/england/premier-league/form-table
- https://www.empireofthekop.com/2022/01/12/three-liverpool-players-have-made-the-bbc-team-of-the-season-so-far-according-to-fan-votes/
- https://www.skysports.com/football/news/15964/13410441/fanalysis-supporter-driven-player-ratings-manager-verdicts-and-perspectives-on-sky-sports
- https://alternativeto.net/software/onefootball/about
- https://apps.apple.com/il/app/one-co-il/id337064110
- https://www.pushwoosh.com/he/blog/one/
- https://apps.apple.com/app/id439572682 (Sport5)
- https://sports.walla.co.il/stats?leagueId=2913&stat=3 and https://sports.walla.co.il/stats?leagueId=2913&stat=4
- https://apps.apple.com/us/app/id1531354603 (Organize Football Games, supports Hebrew)
- https://mwm.ai/apps/footsapp/1469878266
- https://blog.footyaddicts.com/what-is-footy-addicts/
- https://www.spond.com/news-and-blog/free-football-apps/
- https://apps.apple.com/app/id1023658328
- https://www.mentalfloss.com/sports/why-do-americans-call-it-soccer-instead-football-world-cup

Couldn't access or verify: Transfermarkt (fetch blocked), FBref pages (403), OneFootball match page, BBC Sport's current ratings, ESPN Gamecast/lineups, Sport5/ONE match pages, the official IPFL/Ligat Ha'Al site, the IFA amateur leagues.
