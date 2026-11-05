# EA Sports FC card system, and how to adapt it for an amateur peer-rating mode

Research for the neighborhood-football PWA. Date: 2026-11-05. **EA Sports FC 27 is the current game.**

**How to read the numbers.** Every number below has its edition and source type next to it. EA has never published its rating formulas. All the weights here come from fan reverse-engineering and fan guides, and nothing official confirms them. They are good enough to base a simplified formula on. They are not "the EA formula".

---

## 0. TL;DR for the product team

- **Categories.** Use **6 categories** for adults: Speed, Shooting, Passing, Dribbling, Defending, and **Fitness/effort**. Fitness/effort replaces EA's Physical, because for pickup games stamina and work-rate matter more than strength. Use **4 categories** for goalkeepers. Use **3 to 4 categories** for kids, or only positive "traits".
- **Scale.** Use an anchored **1–5 scale relative to the group**, where 3 means "about average in our group". Don't use 1–10 sliders or 1–99. Friends cluster at 6–8 out of 10, and 1–99 numbers look meaningful when they are not. Convert to a 45–95 display number only for the card.
- **Aggregation.** Exclude self-ratings and ignore "flat" rating sheets. Optionally correct for lenient or harsh raters. Use a **trimmed mean** that drops the top and bottom vote once there are 5 or more raters. Apply **Bayesian shrinkage** toward the group mean, with m = 3. Show a stat only once **3 or more raters** have rated it (4–5 is better). **Recompute in weekly batches, not live,** so no one can work out who voted what from the timing.
- **OVR.** Use one position-weighted average of the face stats for each of the app's 4 positions (gk/def/mid/att), plus balanced weights for "plays anywhere". The weights are derived from the fan-reverse-engineered FIFA 18 table (section 2), then adjusted for small-sided games.
- **Dynamic layer.** These are the cheapest wins. Give the week's MVP a **"Player of the week" card variant**, valid for 7 days and worth +1 to +3 on the display only. Show only **upward** change arrows. Let peers tick **positive-only "signature traits"**, an original take on PlayStyles.
- **IP.** Don't use "FIFA", "FUT", "Ultimate Team", "EA Sports FC", "PlayStyles" or "Evolutions" anywhere a user can see them. Don't copy EA's card silhouettes or art. Use Hebrew stat names instead of PAC/SHO/PAS. Metal tiers and a 0–99 number are generic.

---

## 1. Face stats and their sub-attributes

### Outfield players: 6 face stats from about 29 sub-attributes

FC 24 face-stat weights, from the FIFAUTeam "FC 24 Attributes" fan guide. The FC 25–27 sub-attribute list is the same apart from a few renames.

| Face stat | Sub-attributes (weight in the face stat) |
|---|---|
| **PAC** Pace | Sprint Speed 55%, Acceleration 45% |
| **SHO** Shooting | Finishing 45%, Shot Power 20%, Long Shots 20%, Positioning (attacking) 5%, Volleys 5%, Penalties 5% |
| **PAS** Passing | Short Passing 35%, Vision 20%, Crossing 20%, Long Passing 15%, Curve 5%, Free Kick Accuracy 5% |
| **DRI** Dribbling | Dribbling 50%, Ball Control 35%, Agility 10%, Balance 5%. Reactions and Composure are listed in this group at 0%. |
| **DEF** Defending | Standing Tackle 30%, Defensive Awareness (formerly "Marking") 30%, Interceptions 20%, Sliding Tackle 10%. **These add up to only 90%.** The source doesn't list Heading Accuracy, although the game UI groups it under Defending. It is probably the missing 10%, but that is unverified. |
| **PHY** Physicality | Strength 50%, Stamina 25%, Aggression 20%, Jumping 5% |

Notes:
- Fifplay's FC 26 attribute list sorts the same attributes into *Physical* (Acceleration, Agility, Balance, Jumping, Reactions, Sprint Speed, Stamina, Strength), *Mental* (Aggression, Att. Positioning, Composure, Def. Awareness, Interceptions, Vision) and *Skill* groups. That is a different grouping of the same items.
- FC 26 also has a hidden "AcceleRATE" type (Explosive / Controlled / Lengthy). It comes from height, agility, strength and balance, and it changes how pace feels, not the PAC number. A mrgeek.net FC 26 guide notes that FC 26 gives acceleration more equal weight in gameplay feel. That is a gameplay claim, not a change to the face-stat formula.
- Penalties, Curve and FK Accuracy count toward face stats but **don't count toward any position's OVR** (FIFAUTeam, FIFA 16 guide).

### Goalkeepers: a different 6

**DIV** Diving, **HAN** Handling, **KIC** Kicking, **REF** Reflexes, **SPD** Speed, **POS** Positioning. Each is essentially one GK attribute shown 1:1 (FC 24 guide). GK Speed comes from Acceleration and Sprint Speed. The exact split isn't published.

---

## 2. How OVR is calculated

**What EA has said.** A FIFA 08 developer blog (GamesRadar) said 35 attributes feed the overall, with a **separate formula for every position**. For example, Marking, Tackling and Heading matter more for a CB than for a winger.

**The fan-reverse-engineered model** (FIFAUTeam, FIFA 18 guide):
`OVR = ATT + IR`
- ATT is the position-weighted average of the sub-attributes.
- IR is an International Reputation bonus of 0 to 3. A 3★ player above 50 ATT gets +1. A 4★ player gets +1 at 34–66 and +2 at 67 or more. A 5★ player gets +1 at 29–49, +2 at 50–74 and +3 at 75 or more.
- The weights are from FIFA 18 and have probably drifted since, but the structure is still described the same way.

### Position weights (FIFA 18, fan reverse-engineered)

| Position | Weights |
|---|---|
| **ST** | Finishing 18, Att. Positioning 13, Heading 10, Ball Control 10, Shot Power 10, Reactions 8, Dribbling 7, Short Pass 5, Strength 5, Sprint 5, Accel 4, Long Shots 3, Volleys 2 |
| **CF/RF/LF** | Ball Control 15, Dribbling 14, Att. Pos 13, Finishing 11, Short Pass 9, Reactions 9, Vision 8, Shot Power 5, Accel 5, Sprint 5, Long Shots 4, Heading 2 |
| **RW/LW** | Dribbling 16, Ball Control 14, Finishing 10, Crossing 9, Short Pass 9, Att. Pos 9, Accel 7, Reactions 7, Sprint 6, Vision 6, Long Shots 4, Agility 3 |
| **RM/LM** | Dribbling 15, Ball Control 13, Short Pass 11, Crossing 10, Att. Pos 8, Accel 7, Reactions 7, Vision 7, Finishing 6, Sprint 6, Long Pass 5, Stamina 5 |
| **CAM** | Short Pass 16, Ball Control 15, Vision 14, Dribbling 13, Att. Pos 9, Finishing 7, Reactions 7, Long Shots 5, Long Pass 4, Accel 4, Sprint 3, Agility 3 |
| **CM** | Short Pass 17, Ball Control 14, Long Pass 13, Vision 13, Reactions 8, Dribbling 7, Stamina 6, Att. Pos 6, Standing Tackle 5, Tactical/Def. Awareness 5, Long Shots 4, Finishing 2 |
| **CDM** | Short Pass 14, Def. Awareness 14, Standing Tackle 12, Ball Control 10, Long Pass 10, Marking 9, Reactions 7, Stamina 6, Sliding 5, Aggression 5, Strength 4, Vision 4 |
| **RB/LB** | Sliding 14, Def. Awareness 12, Standing 11, Crossing 9, Marking 8, Stamina 8, Reactions 8, Short Pass 7, Ball Control 7, Sprint 7, Accel 5, Heading 4 |
| **RWB/LWB** | Crossing 12, Def. Awareness 12, Sliding 11, Short Pass 10, Stamina 10, Standing 8, Ball Control 8, Reactions 8, Marking 7, Sprint 6, Dribbling 4, Accel 4 |
| **CB** | Standing 17, Marking 14, Def. Awareness 13, Heading 10, Sliding 10, Strength 10, Aggression 7, Short Pass 5, Reactions 5, Ball Control 4, Jumping 3, Sprint 2 |
| **GK** | Diving 21, Handling 21, Positioning 21, Reflexes 21, Reactions 11, Kicking 5 |

### The same weights, rolled up to face stats

This is my own derivation, which an app based on face stats needs. Each FIFA 18 attribute is mapped to its FC 24 face-stat group: Reactions goes to DRI, Heading to DEF, Att. Positioning to SHO, and Marking/Awareness to DEF. Then the weights are summed per position. Every row adds up to 100.

| Position | PAC | SHO | PAS | DRI | DEF | PHY |
|---|---|---|---|---|---|---|
| ST | 9 | 46 | 5 | 25 | 10 (heading) | 5 |
| RW/LW | 13 | 23 | 24 | 40 | 0 | 0 |
| CAM | 7 | 21 | 34 | 38 | 0 | 0 |
| CM | 0 | 12 | 43 | 29 | 10 | 6 |
| CDM | 0 | 0 | 28 | 17 | 40 | 15 |
| RB/LB | 12 | 0 | 16 | 15 | 49 | 8 |
| CB | 2 | 0 | 5 | 9 | 64 | 20 |

What this shows: **EA's OVR barely rewards pace** (0–13%) **or stamina**. Those are exactly what wins a 6-a-side, 7-minute pickup game. Copying EA's weights would under-rate fast, tireless players. Section 6 gives adjusted weights.

---

## 3. Card anatomy, tiers and secondary ratings

### What is on the card face (FC 24–27)

- **OVR** (large, top-left) and **main position** below it (ST, CM, and so on)
- **Player photo** or cut-out
- **Name**
- **Six face stats** with 3-letter labels: PAC SHO PAS DRI DEF PHY, or DIV HAN KIC REF SPD POS for keepers
- **Nation flag, league logo, club crest** along the bottom
- Since FC 24, **PlayStyle+ icons** on the card. Card art and colours also show the **item type** (base, TOTW, promo, Icon, Hero, Evolution)
- **Alternate positions** are shown on recent cards. Which edition introduced this is unsourced. Roles and Role+/Role++ show on the details screen.
- **Details screen only:** preferred foot, weak foot ★, skill moves ★, height, work rates, full attribute list, chemistry, and the roles a player is familiar with (FIFAUTeam "FC 26 Player Items")

### Tiers by OVR (long-standing, still current in FC 26)

| Tier | OVR |
|---|---|
| Bronze | ≤ 64 |
| Silver | 65–74 |
| Gold | 75–99 |

- **Rare vs common** was a second axis, shown as a shinier design.
- **FC 27 removed the common/rare tag** on bronze/silver/gold base cards. Fifplay reports this. It is partly based on pre-launch coverage.
- Special items have their own art regardless of OVR: **TOTW/in-form**, TOTS, TOTY, Icons, Heroes, Evolutions, and promos.
- **The current app already uses the 75/65 thresholds** (`src/screens/PlayerCard.jsx`, `src/styles.css`).

### Secondary ratings

- **Skill Moves 1–5★.** Caps which tricks a player can do. Five stars unlocks everything plus juggles (GamesRadar FC 25/26 skill-move guides).
- **Weak Foot 1–5★.** How usable the non-preferred foot is. Five stars means effectively two-footed. **Preferred foot** (L/R) appears in the bio.
- **Work rates** Attacking/Defensive, each High, Medium or Low (e.g. "H/M"). This is from general knowledge; the search didn't return a definitive explanation. The first value is how much the player gets forward, the second how much they track back.
- **PlayStyles / PlayStyles+** (since FC 24). These are named special abilities that change animations and behaviour, such as Finesse Shot, Rapid, Quick Step, Tiki Taka, Bruiser, Anticipate, Jockey, and Footwork for GKs. They come in categories: Finishing, Passing, Ball Control, Defending, Physical, Goalkeeping. A **PlayStyle+** is the "mastered", stronger version, shown on the card face.
  - **FC 26 (counts disagree):** about 35 PlayStyles according to Insider Gaming, or 36 according to RealSport101. FC 26 added Precision Header, Aerial Fortress, Gamechanger and Inventive.
  - **FC 27:** no new PlayStyles, about 10 reworked, and **at most 3 PlayStyle+ per card, down from 5**. Khel Now, Fifplay and Gamewave report this; the cap figure came from leaks before launch.
- **Roles** (FC 25+). Tactical roles such as Poacher, Box-to-Box or Ball-Playing Defender, with familiarity levels: base, Role+ (mastered) and Role++ (world-class) (GamesRadar, EA Pitch Notes).

---

## 4. Dynamic mechanics and how they map to an amateur app

| EA mechanic | How it works (sources in section 8) | Amateur version |
|---|---|---|
| **Team of the Week (TOTW) / in-forms** | Every week EA picks 23 players (11 starters, 7 subs, 5 reserves) based on real-match performance the previous week. Each gets a boosted "in-form" card, released on Wednesdays. **FIFA 18-era boost rules:** bronze goes to 64; silver to 70–74; gold +2/+3 if 75–78, otherwise +1. A second in-form is +1–2 above the previous one, and can move the player up a tier. | **"Team of the week" (נבחרת השבוע)** made from MVP votes, goals and assists, which the app already tracks. The week's MVP gets a **special-colour card for 7 days** with **+1 to +3 on the displayed OVR only**. The base rating and team drawing are unaffected. A second in-form in the season gets a stacked badge ("2× player of the week"). |
| **Upgrades during the season** (live ratings, "Ratings Refresh") | Base cards are re-rated a few times a season. | Recompute peer stats **weekly or monthly** from standing ballots. Show **"↑ +2 Speed"** for upgrades. For drops, update quietly with **no red arrows**. |
| **Evolutions** (FC 24+) | Eligible cards (capped by OVR, position or stat) complete objectives and get permanent stat and PlayStyle upgrades. **FC 27** adds **Pathways** (branching upgrade choices), **Chain Preview**, and a **"PlayStyles Lab"** where some PlayStyles come pre-applied and others take more effort to unlock. | **Achievements and milestones** that unlock **cosmetic** upgrades, never rating changes: card frame, background or badge at 10/25/50 games, a hat-trick, or a "clean sheet ×5". This keeps the rating honest while rewarding attendance. Possible names: "דרגות" / "מסלול". |
| **PlayStyles / PlayStyles+** | Named signature abilities, with a "+" mastered level. | **Signature traits.** Each rater may tick 0–2 positive traits for a player, for example "Rocket shot", "Wall", "Engine", "Magician", "Playmaker", "Speedster", "Clutch", "Goalkeeper hands". Show the **top 2–3 traits** the most raters picked. Mark a trait "+" (gold) when 50% or more of that player's raters picked it. Traits are positive only. This is the safest, most fun element, and it is excellent for kids. |
| **Reputation bonus (IR)** | +0 to +3 OVR for famous players. | Optional **attendance/experience bonus** of up to +2 for regulars, similar to the existing `games` term in `overall()`. Don't use a "fame" bonus. |
| **Chemistry** | Links based on club, league and nation. | Skip it. A "duo" (הצמד הזהב) award already exists. |

---

## 5. Existing apps and sites that do something similar

| Name | What it does | How ratings are collected | Notes |
|---|---|---|---|
| **SquadCard** (Peerlist project) | Weekly-group app. Rating cards, player of the match, shareable TOTW images for WhatsApp groups. | Teammates rate each other **out of 10** after each game. **Votes are hidden even from the organiser.** **Highest and lowest votes are dropped once enough people have voted**, to limit joke ratings. | Closest competitor. **Unverified:** these details come from a search snippet only, because the page returned 403. |
| **ScoreLegends** (iOS, 2025) | Grassroots match tracker: goals, assists, cards, **MVP vote**, "**your player card evolves after every game**", badges, crew rankings. | Post-match ratings and an MVP vote. The algorithm isn't disclosed. | Shows that an evolving card is a selling point. |
| **Foot8** (Product Hunt) | Private 5-a-side leagues. Personal card with OVR, stats and progress. | The organiser enters result, goals and MVP. The OVR formula isn't disclosed. | Stats-based, like the current app. |
| **Footplr** (iOS) | Team players **rate each other when the match ends**, on a 0–10 scale (doubled from 0–5 in v1.0.2). | Per-match peer rating. | Single number; no categories found. |
| **FutPlayers** (iOS) | Rate own and rival players after the game, plus a player of the match. | Star rating. Averages shown on the profile and the lineup. | Single number. |
| **FutBalance** (Product Hunt, web) | "**Rate your friends anonymously** to level matches automatically." Team drawing from ratings and positions, MVP rankings, a "defensive wall" award. | Anonymous peer ratings feed team balancing. | Close to this app's existing core. |
| **FootballGPT "What's my overall" / Player cards** | AI turns a text description into an "FC-style" OVR out of 99 plus 6 attributes and an archetype label (Poacher, Ball-Winner). | Free text, no peer rating. | Archetype labels are a nice idea, similar to traits. |
| **Card makers**: FUTBIN Card Creator; App Store apps "FUT Cards: FC Card Creator", "FC 26 FUT Card Creator", "FUT Card Creator FC 26"; PyPI `fut-card-creator` | Hand-make an EA-style card: photo, rating, stats, club, nation. | Self-entered, no peer rating. | These reuse EA-style art, which is a **legal grey zone; don't imitate it**. FUTBIN says its cards "cannot be used in EA FC Ultimate Team". |
| **Koratna** (iOS) | Fans rate professional Gulf-league players; cards unlock after you rate. | Fan rating of pros. | Not for amateurs. |

**Gap in the market.** I found no app that combines per-category peer ratings, a FIFA-style face-stat card and team drawing for weekly pickup groups. SquadCard and FutBalance each cover part of it, with single-number ratings.

---

## 6. Recommendations for an amateur advanced mode

### 6.1 Categories (realistic for non-technical friends)

Rating one player on 6 categories takes about 15 seconds. A group of 12 means 11 players × 6 = 66 taps. That is fine as a standing sheet that is filled once and edited occasionally. It is too much as a per-match chore.

**Outfield players (6):**

| Key | Hebrew label (suggested) | Replaces |
|---|---|---|
| spd | מהירות | PAC |
| sht | בעיטה / סיום | SHO |
| pas | מסירה | PAS |
| tec | שליטה וכדרור | DRI |
| def | הגנה | DEF |
| fit | כושר ומאמץ | PHY (stamina and work-rate matter more than strength in pickup games) |

- A **5-category variant** drops "fit" or merges it into "spd".
- **Goalkeepers (4, only for players with gk among their positions):** עצירות/רפלקסים (reflexes), תפיסה (handling), מיקום ויציאות (positioning), משחק רגל/הוצאה (distribution).
- **Kids (3–4):** מהירות, בעיטה, מסירה, הגנה, or **traits only** (6.6).
- **Optional fun extras, never part of OVR:** weak foot 1–5★, rated by peers; preferred foot, self-reported (ימין/שמאל/שתיים); skill ★ for the "Magician" types.

### 6.2 Scale

- **Recommendation:** a 1–5 scale with **anchored, group-relative labels**:
  - 1 = "a weak spot"
  - 2 = "below our average"
  - 3 = "about our average"
  - 4 = "strong"
  - 5 = "among the best here"
- **Why not 1–10.** Friends cluster at 6–8, so a linear map to 0–99 puts everybody in one tier. Self- and peer-assessment research also shows strong leniency and severity effects (ACT RR90-14; many-facet Rasch studies).
- **Why not 1–99.** It suggests a precision that friends can't provide.
- **Why relative anchors.** They push raters to use the whole range, and they make "70" mean "average in this group".
- **Display mapping (fixed and transparent):** `display = round(45 + (score − 1) × 12.5)`, so 1 → 45, 3 → 70, 5 → 95. Average-in-group lands at about 70 (silver). Clearly strong players (about 3.4 or higher) reach the existing **gold ≥ 75** threshold. Only players rated clearly below average fall under 65 (bronze).
- **Expected spread.** OVR averages six stats that have already been shrunk toward the mean, so **most adults will land in silver (65–74) and only a few in gold.** That is acceptable and matches how the tiers feel, but warn the team so it isn't a surprise.
- **I chose fixed thresholds over percentile tiers.** Percentile tiers *guarantee* that someone in every group is bronze. Fixed thresholds plus relative anchors give a natural spread without forcing anybody down.

### 6.3 Aggregation pipeline (per player, per category)

This mirrors what `src/lib/rating.js` / `admin_ratings()` already do for the ranking: self-votes excluded, unmoved ballots ignored, ballots secret even from admins, one standing ballot per voter updated in place.

1. **Standing ballots.** Store one editable rating per (rater, player, category), like the existing ranking ballots. Keep an `updated_at`, and optionally down-weight ratings older than about 6 months.
2. **Exclude self-ratings.** Optionally collect a self-rating for a private "you vs. the group" view, opt-in, never counted. Research supports this. A youth elite soccer study of 267 players found players overestimate their skills relative to their coach. Separately, the Cornell (Dunning-Kruger) findings show the weakest performers are the worst at judging themselves.
3. **Ignore flat sheets.** If a rater gave the same value in every category for every player they rated (3 or more players), ignore that sheet. This is the same idea as the existing `ballotCounts` rule for unmoved ballots.
4. **Correct for lenient or harsh raters (optional, recommended once a rater has rated 5 or more players).**
   - Formula: `adj = r − mean(rater's ratings in this category) + mean(all ratings in this category)`.
   - Each rater rates many players, so the correction can be estimated.
   - ACT simulations found that correction methods beat plain averaging.
5. **Robust centre.**
   - Fewer than 5 raters: plain mean.
   - 5 to 9 raters: drop the single highest and single lowest, then take the mean. This is what SquadCard reportedly does.
   - 10 or more raters: 10–20% trimmed mean.
   - Use the median instead of the mean if simplicity matters more than smoothness.
6. **Bayesian shrinkage.**
   - Formula: `est = (n·x̄ + m·C) / (n + m)`, where C is the group's mean for that category (≈ 3) and m = 3.
   - This is the IMDb Top-250 approach. A player with 2 ratings of 5 doesn't jump straight to 95.
7. **Minimum raters.**
   - Show a category only once n ≥ 3; prefer 4–5 in groups of 15 or more. Below that, show "?".
   - The card shows advanced mode only when every category has reached the minimum. Otherwise fall back to the current stats-based card, which already has a "new" green tier.
8. **Batch recompute.** Update **once a week**, for example the night after game night, or after N new raters. **Never update live.** In a group of 12, a stat that moves seconds after one person votes tells you who voted.
   - A weekly batch still leaks if only one ballot about that player changed that week.
   - So publish a player's new stats only when **at least 2–3 ballots on that player have changed** since the last publish. Otherwise carry the change over to the next batch.
   - The "based on N ratings" counter changes only on publish.
9. **Rounding and confidence.**
   - Show integers.
   - Show "based on 7 ratings" on long-press. Never show who rated, or the individual votes.
   - An optional range ("68–74") when n is small reads as gentler than a single hard number.

### 6.4 Avoiding hurt feelings

- **Never show**:
  - who rated what
  - the per-rater spread
  - a public "worst at X" list
- **Show the player their own card privately first.** Group visibility is a group setting: admins only, everyone, or nobody.
- **Lead with strengths.** For example, highlight the player's top 2 categories in colour.
- **Upward-only arrows** on refresh. Changes are batched and quiet.
- **Make positive traits the most visible element.** Numbers stay secondary.
- **Let anyone opt out** of being rated in advanced mode. They keep the basic card.
- **Moderation.** Admins can see that a rater has rated, and how many players, as `ballot_status` already does for ranking. Admins never see the values.

### 6.5 Simplified position-weighted OVR (amateur-adjusted)

The FIFA 18-derived weights are in section 2. The weights below are adjusted for small-sided pickup games: more pace and fitness, and less dominance by a single stat. Each row adds up to 100.

| App position | spd | sht | pas | tec | def | fit | Closest EA position |
|---|---|---|---|---|---|---|---|
| att (התקפה) | 20 | 35 | 10 | 20 | 5 | 10 | ST (EA: 9/46/5/25/10/5) |
| mid (קישור) | 10 | 10 | 30 | 20 | 15 | 15 | CM (EA: 0/12/43/29/10/6) |
| def (הגנה) | 15 | 0 | 15 | 5 | 45 | 20 | CB (EA: 2/0/5/9/64/20) |
| any (כל מקום) | 17 | 17 | 17 | 17 | 16 | 16 | balanced |
| gk (שוער) | reflexes 35, handling 25, positioning 25, distribution 15 | | | | | | GK (EA: 21/21/21/21 + react 11 + kick 5) |

Rules:
- `OVR = round(Σ wᵢ·statᵢ / 100)`, applied to the 45–95 display stats.
- **For players with several positions,** compute OVR for each listed position and show the **highest**, with that position label on the card. EA's card shows the main position, and OVR changes by slot.
- For the 5-category variant (no "fit"), redistribute the "fit" weight proportionally across the others.
- Optional: up to +2 for experience/attendance, an analogue of IR, capped at 99.

**Team drawing.**

How it works today:
- `make_teams` in `supabase/schema.sql` (mirrored by `splitTeams` in `src/lib/teams.js`) balances teams on each player's **ranking `score` (0–100)**, with **`coalesce(score, 50)`** for unranked players.
- Keeper-only players are spread one per team.
- It runs inside the database so ratings stay private.

Proposal:
- **Put every input on one 0–100 scale before blending.** Peer OVR clusters at 45–95, and `overall()` runs 45–99 and is null below 3 games. Blending raw values would let the 0–100 ranking dominate whenever the inputs disagree.
- **Simplest normalisation:** convert each input to a **within-group percentile** (0–100). Alternatively use `(OVR − 45) × 2`.
- Then `strength = 0.5·pct(peer OVR) + 0.5·pct(ranking score)`.
- When the group has match history, optionally make it `0.4·pct(peerOVR) + 0.4·pct(rank) + 0.2·pct(overall())`.
- Drop any missing input and renormalise. Fall back to 50, as today.
- Keep the computation in the database, as `make_teams` does now.
- Never feed the temporary in-form boost into team drawing.

### 6.6 Kids' groups

- **Default to traits-only.** No numbers, no OVR, no tiers. Kids pick "what is he great at" from positive traits; each kid's top 2–3 traits show.
- If numbers are used:
  - only coaches or parents rate
  - only each child's **top 3 strengths** are shown
  - **no bronze**: one shared "team colour" card, or tiers reserved for adults
  - no leaderboard and no bottom list
- **Why.** Coaching and sport-science voices (TrueSport, the Alan Stein essay) advise against publicly ranking young players because development varies and self-worth gets tied to rankings. That is practitioner consensus, not hard research.
- **Privacy.** Minors' **photos and names on shareable card images** (the existing `cardImage.js` WhatsApp/Instagram export) need parental consent. Default sharing to off for kids' groups.
- **Data rules.** Collect minimal data. Children's data rules apply (COPPA in the US, GDPR-K in the EU, the Israeli Privacy Protection Law). This is not legal advice.

---

## 7. IP caution (not legal advice; get a lawyer's opinion before launch)

**Belongs to others: avoid in UI, marketing, app name and store listing**
- **"FIFA"** is a trademark of **FIFA, the federation**, not of EA. EA's licence ended in 2022, when EA and FIFA said on 10 May 2022 that it would not be renewed. Avoid "FIFA-style" even in marketing.
- **EA marks:** "EA SPORTS", "EA SPORTS FC", "**Ultimate Team**", "**FUT**".
  - FOOTBALL ULTIMATE TEAM is a registered USPTO word mark (97555699).
  - "FUT FOOTBALL ULTIMATE TEAM" was filed in June 2025.
  - Trademarks are territorial. Only US (USPTO) records were checked. **Israeli and EU registrations were not checked**, and they matter for a Hebrew-first product.
- **EA's in-game feature names** (some may only be unregistered marks): "PlayStyles"/"PlayStyle+", "Evolutions", "TOTW" as a branded item, "Icons", "Heroes", "FUT Champions", "Rush". Generic phrases such as "team of the week" or "player of the week" in Hebrew are ordinary football language.
- **Card art.**
  - EA's card artwork, the specific shield/notched silhouettes, backgrounds and fonts are copyrighted. They may also be protectable as trade dress.
  - Don't trace or copy FUTBIN or card-maker templates, which reproduce EA designs.
- **Real club crests and league logos** belong to the clubs and leagues. Use the group's own emoji/logo in that slot instead; the app already has group emojis.

**Generic: fine to use**
- Gold, silver and bronze metal tiers (long used by trading cards).
- A 0–99 rating, a big number in the corner, and six attributes with short labels.
- Ratings, stats and "player cards" as concepts. Game mechanics are generally not protected by copyright.

**Recommendations**
- Use **Hebrew stat names** (מהירות / בעיטה / מסירה / שליטה / הגנה / כושר) and **original abbreviations or icons**, not PAC/SHO/PAS/DRI/DEF/PHY. Those 3-letter codes are probably not protectable, but they strongly signal EA.
- Design an **original card shape**, for example a rounded rectangle or a jersey/pitch motif, with the app's own typography.
- Code: two comments mention "FIFA style" (`src/styles.css:841`, `src/lib/cardImage.js:1`), and there is an internal CSS class `fut-card`. These are internal and harmless. Keep "FUT" and "FIFA" out of anything user-facing, including the README screenshots' captions and store text.

---

## 8. Sources

**Attributes and face stats**
- FIFAUTeam, FC 24 Attributes (face-stat weights): https://fifauteam.com/?p=224582
- Fifplay, FC 26 Attributes: https://www.fifplay.com/fc-26-attributes/
- FIFAUTeam, FC 26 Attributes: https://fifauteam.com/fc-26-attributes/
- mrgeek.net, How pace works in FC 26: https://www.mrgeek.net/blog/how-pace-works-fc-26-acceleration-sprint-speed-explained

**OVR formula**
- FIFAUTeam, FIFA 18 Player Ratings Guide (position weights and IR table): https://fifauteam.com/?p=37164
- FIFAUTeam, The Influences of the FIFA 16 Attributes (attributes not counted in OVR; IR): https://fifauteam.com/?p=18498
- FIFAUTeam, FIFA 19 ratings guide: https://fifauteam.com/?p=49146
- GamesRadar, FIFA 08 developer blog #5 ("every position has its own formula"): https://www.gamesradar.com/fifa-08-360ps3-developer-blog-5/3
- R-bloggers, FIFA 14 attributes per-position regression: https://www.r-bloggers.com/2013/12/insight-from-fifa-14s-player-attributes-using-r/amp/

**Cards, tiers and TOTW**
- FIFAUTeam, FC 26 Player Items: https://fifauteam.com/?p=327778
- FIFAUTeam, Ultimate Team cards explained: https://fifauteam.com/fifa-ultimate-team-players-cards-explained/
- FIFAUTeam, FIFA 18 TOTW guide (boost rules): https://fifauteam.com/?p=30747
- GGRecon, FC 24 card design: https://www.ggrecon.com/guides/easfc-24-card-design/

**PlayStyles, roles, skills**
- Insider Gaming, FC 26 PlayStyle changes: https://insider-gaming.com/every-ea-fc-26-playstyle-change-explained/
- RealSport101, FC 26 new PlayStyles+: https://realsport101.com/article/fc-26-new-playstyles
- FUTBIN, PlayStyles list: https://www.futbin.com/26/playstyles
- GamesRadar, FC 25 Roles and familiarity: https://www.gamesradar.com/games/ea-sports-fc/fc-25-player-roles-familiarity
- EA, FC 25 Pitch Notes, gameplay deep dive: https://www.ea.com/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-gameplay-deep-dive
- GamesRadar, FC 26 skill moves: https://www.gamesradar.com/games/ea-sports-fc/fc-26-skill-moves
- Magic Game World, FC 26 weak foot and preferred foot: https://www.magicgameworld.com/ea-fc-26-how-to-check-preferred-foot-weak-foot-ratings-in-ultimate-team/

**FC 27 changes**
- Fifplay, FIFA 26 to FC 27 changes: https://www.fifplay.com/article-fifa-26-to-fc-27-what-changed-in-ultimate-team/
- Khel Now, FC 27 PlayStyles overhaul (cap of 3): https://khelnow.com/gaming/ea-fc-27-playstyles-overhaul-playstyle-cap-reduced-major-nerfs-202607
- Gamewave, FC 27 no new PlayStyles: https://gamewave.fr/fc-27/fc-27-pas-de-nouveaux-playstyles-mais-de-nombreux-changements-voici-les-details/
- RealSport101, FC 27 Evolutions (Pathways, Chain Preview, PlayStyles Lab): https://realsport101.com/article/fc-27-evolutions-changes-pathways-chain-preview-playstyles-lab
- fut.gg, FC 27 PlayStyle nerfs and buffs: https://www.fut.gg/news/every-playstyle-nerf-and-buff-in-ea-fc-27-full-list-of-changes/

**Evolutions (FC 26)**
- fut.gg, Evolutions: https://www.fut.gg/evolutions/
- Fifplay, FC 26 Evolutions: https://www.fifplay.com/fc-26-evolutions/
- allthings.how, FC 26 Evolutions: https://allthings.how/evolutions-in-ea-fc-26-the-best-early-upgrades-and-who-to-pick

**Amateur apps**
- SquadCard (unverified snippet; page returned 403): https://peerlist.io/ignaciouliczki/project/squadcard
- ScoreLegends: https://apps.apple.com/ae/app/scorelegends/id6755430110
- Foot8: https://hunted.space/dashboard/foot8
- Footplr: https://apps.apple.com/be/app/footplr/id1018867015
- FutPlayers: https://mwm.ai/apps/futplayers/1475834609
- FutBalance: https://www.producthunt.com/products/futbalance
- FootballGPT, What's my overall: https://footballgpt.co/labs/whats-my-overall
- FootballGPT, Player cards: https://footballgpt.co/labs/player-cards
- FUTBIN Card Creator: https://www.futbin.com/26/fut-card-creator
- FUT Cards: FC Card Creator (App Store): https://apps.apple.com/app/id6744385298
- Koratna: https://apps.apple.com/us/app/-/id6738292193
- Footsapp, The Mancunion (2021): https://mancunion.com/2021/03/20/footsapp-the-future-of-amateur-football/

**Aggregation and psychology**
- IMDb Help, weighted average ratings: https://help.imdb.com/article/imdb/track-movies-tv/weighted-average-ratings/GWT2DSBYVT2F25SK
- fxsolver, IMDb Bayes estimator: https://www.fxsolver.com/browse/formulas/Bayes+estimator
- ACT Research Report 90-14, rater leniency and stringency correction: https://act.org/content/dam/act/unsecured/documents/ACT_RR90-14.pdf
- IJPES, rater biases of peer assessors (anonymity reduces bias): https://ijpes.com/index.php/ijpes/article/view/622
- Hanze, self-evaluation in youth elite soccer (players overestimate): https://research.hanze.nl/en/publications/self-evaluation-of-skills-and-performance-level-in-youth-elite-so/
- EJOP 2018, PE soccer passing self-assessment: https://doaj.org/article/531d274be38d4027bfd59470d7c410f2
- TrueSport, ranking youth athletes: https://truesport.org/?p=10028
- Basketball Manitoba, Alan Stein on player rankings: https://www.basketballmanitoba.ca/2014/05/the-player-ranking-cult.html

**IP**
- FOOTBALL ULTIMATE TEAM, USPTO 97555699: https://gleanmark.com/trademark/uspto-97555699
- FUT FOOTBALL ULTIMATE TEAM filing: https://trademarkregistration.app/Trademark/Details/99232088
- Footy Headlines, FUT rename after the FIFA split: https://www.footyheadlines.com/2023/05/exclusive-ea-sports-to-rename-fifa.html
- WJLTA, legal fallout of the EA–FIFA split: https://wjlta.com/tag/fifa/
