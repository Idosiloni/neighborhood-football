# Market and Platform Research: Neighborhood Football PWA

Prepared 2026-11-05. Scope: competitors, organizer settings, kids/youth (product and legal), youth match formats, the path from PWA to the app stores, and monetization.

**How to read the sources.** Each price or rating is tagged **[official]** (the vendor's own page or help center), **[store]** (the App Store listing, fetched Nov 2026), or **[aggregator]** (Capterra, G2, blogs, competitor marketing). Aggregator numbers often conflict with each other, and where they do, both figures are shown. Nothing in the legal sections is legal advice. The COPPA, GDPR and Israeli-law items should go to a lawyer before the kids mode launches.

---

## 0. TL;DR: what this means for the product

1. **Your onboarding is a real advantage.** Every mainstream team app (Spond, TeamSnap, Heja, SportEasy, Footy Addicts) makes each member create an account by email, phone, Google or Apple, often with a verification code. Heja asks a parent for the team code, then account creation, then email verification, then approval. Footy Addicts' few US reviews are mostly login and account complaints. The only competitors with no accounts are offline "team generator" apps, which can't do signups. BenchApp's text-message RSVP ("reply Yes/No, no app or account needed") is the closest thing to your personal-link model.
2. **Nobody combines your core loop.** The loop is WhatsApp list, then signups, then balanced teams from peer ratings and positions, then match clock, then MVP and player cards. Team apps (Spond, TeamSnap, Heja) do RSVP but not balanced teams. Team-maker apps balance teams but have no signups, links or groups. Pickup marketplaces (Plei, OpenSports, Footy Addicts) sell spots in games run by venues or organizers; they don't serve a closed group of friends. Locker Lounge, a small Product Hunt launch, says outright that pickup soccer runs on WhatsApp and is the nearest concept to yours. I found no Israeli competitor for neighborhood games (Lazuz, Socaloca and Fulby are field booking or finding games).
3. **Complaints are the same across the category:** ads (TeamSnap even shows them on paid plans, and Spond is criticized for them), core features behind a paywall (TeamSnap availability, Heja calendar sync, later reversed after backlash), too many notifications or late ones (Spond), and the leftover habit of "I still repost it to WhatsApp." The lessons: no ads, never paywall anything a player touches, keep notifications minimal, and treat WhatsApp as the distribution channel rather than a competitor.
4. **Monetization that fits the category:** players free forever, with an optional organizer "Pro" at about $3–6/month or $25–50/year. Comparable prices: Heja Pro $13.49/mo, SportEasy €9.99/mo or €69/yr, BenchApp Pro $9/mo or $99/yr, TeamStats €6–15/mo. Start money collection with deep links (no processing, no fees, no licensing) rather than payment processing. A user of a processed-payment tool complained of paying "$14.70 in fees a week" for a 10-player game.
5. **Kids mode has to be a different product mode, not a skin.** Coach or parent acts for the child, no child-held links, no peer ratings or MVP votes by children, no public rankings or standings. US Soccer's own guidance for 4v4 and 9v9 is "Results and standings should not be recorded." Don't list in the Apple Kids Category; target coaches and parents. Under 5.1.4(b), the store listing must not imply that children are the main audience.
6. **The app-store path:** ship Android first as a TWA (via Bubblewrap/PWABuilder) and iOS via Capacitor with real native features, because a bare wrapper risks guideline 4.2. Budget $99/yr for Apple and $25 once for Google. A new *personal* Play account needs 12 testers opted in for 14 days; an organization account is exempt but needs a D-U-N-S number. Your no-login model avoids the Sign in with Apple obligation (4.8), but you still need a privacy policy, in-app data/account deletion, and a public deletion URL for Google Play.

---

## 1. Competitors

### 1.1 Team-management apps (club and team oriented)

| App | Core features | Onboarding friction | Monetization / pricing | Ratings and review themes |
|---|---|---|---|---|
| **Spond** (Norway) | Events, RSVP, max participants and waitlist, deadlines, recurring events, season planner, chat, payments | All groups private; invited by email, phone, link, or 5-letter group code. Non-users get an email telling them to download the app and create an account. Single events can allow sign-up "without a Spond profile" if the organizer permits. | **Free app; earns only from payments** via Stripe. Fees are charged per product **[official]**: **US $1.00 + 3.29%**, UK £0.20 + 2.5%, EUR €0.20 + 2.5%. Group pays by default, or the fee can be passed to members. | **4.9/5, 3.9K ratings (US) [store]**. Praise: ease of use, RSVP tracking. Complaints: notifications late or overwhelming across several kids/teams, calendar sync, ads, a junior-club privacy worry (members see everyone's info), a user who disabled push was then texted. |
| **TeamSnap** (US leader) | Scheduling, availability, messaging, payments/registration, stats (web) | Account required; household and invite flows are complained about ("invitation loop"). | Freemium plus ads. Store IAPs: Ad Free $2.49/$5.99, Plus $1.99, "Content & Ad-Free" $6.99–$59.99 **[store]**. Aggregators cite Plus ≈ $12.50/mo and Premium $22.99/mo **[aggregator, unverified]**; club pricing by quote. | **4.8/5, ~60K ratings (US) [store]** but **Trustpilot 1/5 (690 reviews)**. Complaints: ads, including on paid tiers and shown to youth athletes; full-screen ads; availability behind paywall; buggy messaging; hard to reach support. |
| **Heja** (Sweden) | Schedule, RSVP, chat, photos, parent↔child linking, attendance stats | Team code → choose parent/player → account (Google/email/Apple) → email verification code → approval. Teens can "claim" their own account. | Free core; per-team premium. Store **[store]**: Heja Plus $3.99 / $29.99 yr; **Heja Pro $13.49/mo, $99.99/yr**; Team Pro Max $18.99/mo, $139.99/yr (ad-free for the whole team, calendar sync, attendance stats). | **4.8/5, 24K ratings (US) [store]**. Praise: simple and free, parent-child mapping. Complaints: tedious season entry, no "TBA" time, slow media, and **backlash when calendar sync moved to paid (reversed)**. |
| **SportEasy** (France) | Calendar, RSVP, messaging, stats, lineups | Account per member | Free ≤30 members with ads; Premium **€9.99/mo or €69/yr** per team; clubs ≈ €0.33–0.45/member/mo **[aggregator]** | Capterra ~4.5 **[aggregator]** |
| **TeamStats** (UK, football-only) | Fixtures, availability, line-ups, match reports (AI on premium), stats, finances | Account | Free tier; Plus/Pro/Elite ≈ **€6/€9/€15 per team per month** (€60/90/150 yr); receiving payments needs Pro; ads on lower tiers **[aggregator]** | 4.5–4.9 **[aggregator, self-cited]** |
| **SportMember** (Denmark) | Calendar, registration, parent access | Account | Free with banner ads; Premium ≈ £0.49/mo individual, £4.49/mo team; club Pro per user **[official UK site + aggregator]** | Capterra ~4.0. Complaints: ads, slow loading, too many push notifications |
| **Clupik** (Spain) | Club website/app builder, memberships, fees, store | Club-level | Paid, ≈ €35+/mo **[aggregator, conflicting]** | n/a. Club ERP, not a direct competitor |
| **FA Matchday** (England) | Team sheets, match fees via PayPal, league integration | FA account | Believed free (FA-backed; pricing unverified); PayPal match fees | Adoption pushed via county FAs; incentives (kit) in 2019 |
| **BenchApp** (US/Canada, hockey-first) | Schedule, roster, RSVP, payment tracking, pickup groups | **Text-message RSVP, players reply Yes/No with no app or account** (Pro) | Free; **Pro $9/mo or $99/yr per team, only the manager pays**; League $10/team/mo **[official]** | User complaint in feature forum: processed payments for a 10-player weekly game cost **$14.70/week in fees** |

### 1.2 Pickup / marketplace apps (sell spots in games)

| App | Model | Onboarding | Monetization | Notes |
|---|---|---|---|---|
| **Footy Addicts** (UK) | Public 5–11-a-side games run by organizers; join and pay per game | Account (email/password) | **Per-player game fee**, e.g. £5–£7.50 **[official listings]**; game packs and top-ups | UK Trustpilot 4.5 (87). US store 3.7 (23 ratings), with complaints mostly about login |
| **Plei** (US, Miami) | Largest US pickup-soccer organizer; game feed, guests, skill levels | Account | Players pay ≈ $5–14/game; venues pay ≈ $199/mo for facility software **[press, dated]**; no charge if game doesn't reach minimum | Venture/crowdfunded |
| **OpenSports** (Canada) | Pickup groups/clubs; payments, waitlist auto-fill, credits, guests | Players can get invites/notifications by email **without the app** | **Now paid:** Recreational Group **$30/mo**, Club $70/mo, Premium $750+/mo, plus **3% transaction fee + Stripe** **[official pricing page, Nov 2026]**. (**Conflict between two official OpenSports pages:** another OpenSports page says it "only charges for paid events, no monthly fees" with 3% + Stripe, and a 2019 Inc. profile said 5% of revenue. Which one is current is unclear.) | Their waitlist/credit model is the best organizer reference (see §2) |
| **Playtomic** (Spain; padel-first) | Court booking with **split payment** | Account + card on file | Club pays SaaS; players pay service fees; booker's card is charged for unpaid shares 2h after match | Useful pattern: "organizer guarantees, players pay their share" |
| **Kickabout** (Ireland) / **KickAbout.Me** | Organize 5-a-side, invite, pick teams, record goals, POTM, track payments | Account | Freemium | KickAbout.Me is the closest feature match (teams + POTM + payments) |
| **Locker Lounge** (Product Hunt, solo dev) | Pickup soccer clubhouse that replaces the WhatsApp chat | n/a | Free now; "leaning toward organizer-pays subscription, players always free" | Same thesis as yours |

**Searched but not found or not relevant:** **OpenPlay**: no pickup-football app by this name was found (searches returned OpenSports). **PlayOn**: a Notre Dame startup that links people for sports and handles league registration and payments (https://ideacenter.nd.edu/commercialization-engine/startups/playon/), plus a separate tennis partner-finder "PlayOn - Find sport partner" (https://apps.apple.com/us/app/id6445921680). Neither is a direct competitor. Other small "Pickup" apps exist (e.g. https://apps.apple.com/us/app/-/id6743626035).

### 1.3 Team-generator apps (no accounts, no signups)

Examples: Team Maker - Random Squads, Captain's Team Maker, Lineup Coach (small-sided, positions + skill), **Dobello** (5v5–11v11, positions), Quick Teams, Gamdok (skill + position), SquadShuffle (paid), Team Picker, Build My Team (~$2, data stays on device, shares lineup to chat), Team Split PRO, SquadBalance (web, collects ratings from players). They are **single-device tools with no shared signup list**, and most rate skill from one person's view (the organizer). None of the ones found combines **peer** ratings, a paste-in WhatsApp list, and per-player links.

### 1.4 Israel

- No Israeli app for neighborhood pickup groups turned up in English or Hebrew searches. Candidates found: **Lazuz** (field booking + partners, status unclear), **Socaloca** and **Fulby** (find games, origin unconfirmed), and the IFA app (scores and news only).
- The de facto Israeli tool is a **WhatsApp group with a numbered list** that people copy-paste and append their name to. That makes your paste-in list matching the most important feature for Israel.

### 1.5 Match/timer tools (adjacent)

PlayFlow, Coachany (1–4 periods), Soccer Teammate (periods per competition), Match Keeper (halves/quarters + extra time), FTACT (live clock + subs/cards/goals), FairSub/PlayFairly (fair youth substitutions). I found **no app with a built-in "winner stays on" rotation mode**, even though real pickup listings use it (e.g. Footy Addicts "STAY-ON 6v6v6", "4-minute rotations").

**Sources (§1):**
Spond fees https://help.spond.com/app/en/articles/118091-payments-costs-in-the-spond-app · Spond store https://apps.apple.com/us/app/spond/id755596884 · Spond join/invite https://help.spond.com/app/en/articles/130403-join-a-group , https://help.spond.com/en/articles/25853-spond-app-how-to-invite-non-spond-users-to-events · Spond reviews https://justuseapp.com/en/app/755596884/spond/reviews , https://www.capterra.com/p/181253/Spond/reviews/ · TeamSnap store https://apps.apple.com/us/app/teamsnap/id393048976 · TeamSnap pricing https://teamsnap.com/pricing , https://go.secondslide.io/teamsnap-pricing , https://www.benchapp.com/blog/best-teamsnap-alternatives · TeamSnap complaints https://g2.com/products/teamsnap/reviews , https://nl-be.trustpilot.com/review/teamsnap.com · Heja store https://apps.apple.com/us/app/heja/id1157335714 · Heja plans https://help.heja.io/en/articles/3727834-heja-free-vs-team-pro-or-max · Heja join flow https://help.heja.io/en/articles/9618901-adding-or-connecting-to-your-child-as-a-new-user , https://help.heja.io/en/articles/12731204-claiming-your-own-player-account-on-heja · SportEasy https://www.capterra.co.uk/software/162745/sporteasy , https://europeanpurpose.com/tool/sporteasy · TeamStats https://europeanpurpose.com/tool/teamstats , https://www.capterra.com/p/172849/TeamStats/ · SportMember https://sportmember.co.uk/en/what-does-it-cost--3 , https://www.capterra.co.uk/reviews/167292/sportmember · Clupik https://www.capterra.com/p/215454/Clupik/ · FA Matchday https://www.thefa.com/news/2019/feb/27/fa-paypal-partnership-kicks-off-270219 · BenchApp https://benchapp.com/pricing , https://benchapp.com/blog/best-free-app-managing-recreational-sports-team , fee complaint https://feedback.benchapp.com/b/3v2rr8mn/feature-ideas/drinks-notification · Footy Addicts https://apps.apple.com/us/app/footy-addicts-play-football/id980967349 , https://nl-be.trustpilot.com/review/footyaddicts.com , https://footyaddicts.com/football-games/127506-8-a-side-football-fox-hollies-leisure-centre-acocks-green · Plei https://apps.apple.com/us/app/id1225575821 , https://refreshmiami.com/news/on-demand-soccer-startup-kicks-off-equity-crowdfunding-campaign/ · OpenSports https://opensports.ca/pricing , https://opensports.ca/blog/why-you-should-collect-payment-through-opensports · Playtomic https://playerhelp.playtomic.com/hc/en-gb/articles/19832089052561 · Kickabout https://apps.apple.com/us/app/id6444311900 , https://www.offtheball.com/Kickabout:-The-Irish-app-that-helps-set-up-5aside-games--246950 · Locker Lounge https://www.producthunt.com/p/locker-lounge-pickup-soccer-sorted/locker-lounge-pickup-soccer-sorted · Team makers https://mwm.ai/apps/id/1385060630 , https://apps.apple.com/app/id6759995215 , https://mwm.ai/apps/lineup-coach/6757500480 , https://apps.apple.com/us/app/id6762158929 , https://apps.apple.com/us/app/-/id6467277454 , https://apps.apple.com/app/id689018834 , https://peerpush.com/p/squadbalance · Israel https://www.itayalon.com/en/?p=4847 , https://apps.apple.com/il/app/socaloca/id1510704966?l=he , https://apps.apple.com/il/app/fulby/id1488365688?l=he · Timers https://mwm.ai/apps/playflow/6758162479 , https://play.google.com/store/apps/details?id=com.coachany , https://apps.apple.com/gr/app/match-keeper/id1558022379?l=el , https://apps.apple.com/app/id6749849332 · Stay-on format https://footyaddicts.com/football-games/361505-9-a-side-football-saca-football-arena-aston-west-midlands

---

## 2. Settings competitors expose to organizers

| Setting | Who does it / how | Recommendation for us |
|---|---|---|
| **Max participants + waitlist** | Spond: "Max number", first-come-first-served, then automatic waiting list. OpenSports: auto-promotion; if the promoted player doesn't respond, the next is notified; organizer can "cancel the waitlist" to open spots to all; scheduled auto-cancel (Feb 2025). | Must-have. Default: cap = 2 × team size (or 3 × for 3-team rotation); auto-promote + notify via share link. |
| **RSVP / registration deadline** | Spond: for single and recurring events; after it, only the admin changes statuses. | Optional "signups close X hours before". |
| **Cancellation deadline** | OpenSports: credit-based refund deadline, as late as 23h before; **automatic reminder 24h before**, then 1h to cancel. | "Drop-out deadline" + reminder; flag late drop-outs (soft, no penalties by default). |
| **Reminders** | Spond: manual "Send reminder"; Spond Club: automatic. OpenSports: automatic 24h. | One-tap "share reminder to WhatsApp" (prefilled text + link). |
| **Recurring schedule** | Spond: recurring events, "edit this and all future"; season planner bulk-sets max and deadline. | Weekly recurrence (day/time/venue), auto-open next game after the previous ends. |
| **Guests / +1** | OpenSports: organizer sets guests per attendee; guest bundled with host's registration and refund. Plei: add guests to reservation. | "+1 guest" with name; guest gets rating defaults; counts toward cap. |
| **Fees per game** | Spond (fee per event, group or member pays the fee), OpenSports (paid events), Footy Addicts (per player), Playtomic (split). FA Matchday: fees requested after the team sheet. | Per-game price field + "who paid" checklist + deep-link pay buttons (see §6). |
| **Match length / periods** | Coachany 1–4 periods; Match Keeper halves/quarters + extra time; PlayFlow per-half length; Soccer Teammate per competition. | Presets: 1 × N min (pickup), 2 halves, 4 quarters (US youth), custom; break length; stoppage. |
| **Team size / format** | Footy Addicts 5–11-a-side; Dobello 5v5–11v11. | 5v5 / 6v6 / 7v7 / 8v8 / 9v9 / 11v11 + "with/without GK". |
| **Number of teams / rotation** | Real pickup formats: 3-team "winner stays on", fixed 4–8 min rotations, tie rules vary ("tie → challenger stays", or "draw → last winner steps off", or rock-paper-scissors). **No app found implements this.** | Differentiator: 2–4 teams, mode = winner-stays / timed round-robin / goal cap (first to 2), with configurable tie rule and max consecutive games. |
| **Multiple venues** | Spond/TeamSnap: location per event, maps integration (TeamSnap Apple Maps/Waze). | Saved venues per group + Waze/Google Maps link (Waze is key in Israel). |
| **Check-in / attendance** | OpenSports check-ins, Heja attendance stats (paid). | Organizer marks no-shows; attendance stats free. |

Sources (§2): https://help.spond.com/en/articles/26059-spond-app-understanding-event-settings , https://help.spond.com/en/articles/25861-how-to-set-up-recurring-events , https://help.spond.com/en/articles/25877-how-to-track-and-trace-event-attendees , https://help.spond.com/en/articles/25859-how-to-use-the-season-planner-feature , https://opensports.ca/blog/waitlists-for-sports-and-fitness-groups-with-popular-events , https://opensports.ca/blog/opensports-credit-system-and-cancellation-deadlines , https://opensports.ca/changelog , https://opensports.ca/blog/cancel-the-waitlist-and-immediately-open-spots-to-everyone-on-it , https://opensports.ca/blog/can-players-add-guests-to-an-event , https://www.sportsessionplanner.com/s/uGtXh/Small-Sided-Games-(CPE-Meeting).html , https://pickuphub.net/34154 , https://philadelphia.leaguelab.com/league/100704/details

---

## 3. Kids / youth

### 3.1 What youth apps do differently

- **The parent is the account holder, and the child is a profile.** Heja: the parent joins via team code and links to the child; a second guardian can be added; a teen can later "claim" their own player account with birth date + own email. TeamSnap uses "households". Spond groups contain children managed by guardians.
- **Coaches see parent↔child mapping** (praised Heja feature).
- **Privacy complaints happen:** a Spond reviewer was alarmed that in a junior club everyone in the group could see each other's information. TeamSnap is criticized for showing ads to youth athletes and parents with no opt-out.
- **The youth-development philosophy discourages results:** US Soccer PDI says for 4v4 "Results and standings should not be recorded", the same for 9v9, and every player should play ≥50% of each game (7v7/9v9). The FA applies "child-friendly competition" at U7–U11.

### 3.2 Legal constraints (summary, verify with counsel)

**US – COPPA (FTC).** Applies to services directed to children under 13 *or* with actual knowledge of collecting personal info from under-13s. The **amended rule took effect June 23, 2025; full compliance was required by April 22, 2026**. Changes include a written information-security program, an expanded definition of "personal information", a "mixed audience" definition, and more consent methods. Practical reading for us: if children themselves hold links, submit ratings, vote MVP, or upload photos, we are collecting from children and need verifiable parental consent. If **only the coach or parent enters minimal data** (first name or nickname, no photo, no contact info) and children never use the app directly, exposure is much lower. *Needs legal review.*
Sources: https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule , https://www.loeb.com/en/insights/publications/2025/05/childrens-online-privacy-in-2025-the-amended-coppa-rule , https://bassberry.com/news/amendments-to-the-coppa-rule-now-in-effect/ , https://www.toyassociation.org/ta/PressRoom2/News/2026-News/updated-coppa-rule-requirements-take-effect-april-22.aspx

**US – state "App Store Accountability Acts".** Utah (compliance May 2026, enforcement from Dec 31, 2026), Louisiana, and Texas (SB 2420, **enjoined by a federal court Dec 23, 2025**, under appeal). App stores pass age category and parental consent to developers. Developers must use that signal, and receiving it may create "actual knowledge" of a user's age. There is a good-faith safe harbor. Apple's Declared Age Range API is the delivery mechanism to check. Sources: https://www.venable.com/insights/publications/2025/12/new-app-developer-compliance-requirements , https://www.pillsburylaw.com/en/news-and-insights/app-store-accountability-act-texas.html , https://www.sheppard.com/insights/blogs/utah-pioneers-app-store-age-limits

**EU – GDPR Art. 8 ("GDPR-K").** For information-society services offered directly to a child, consent-based processing needs parental consent under 16; member states may lower the age to 13. Also data minimisation and privacy by design. **UK – Age Appropriate Design Code (Children's Code):** high-privacy defaults, no nudging, profiling and geolocation off by default for under-18s. Sources: https://gdpr-info.eu/art-8-gdpr/ , https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/ (from general knowledge, not fetched this session).

**Israel – Privacy Protection Law, Amendment 13 (in force Aug 14, 2025).** Expanded definitions, stronger Privacy Protection Authority with administrative fines, DPO for large-scale or systematic monitoring. Minors' data is treated as **"especially sensitive"**, and holding it for more than 100,000 people triggers a database notification (secondary source). **No dedicated child-consent age**, so general consent rules apply and parental consent is prudent. Sources: https://iapp.org/news/a/israel-marks-a-new-era-in-privacy-law-amendment-13-ushers-in-sweeping-reform , https://www.pearlcohen.com/major-amendment-to-israeli-privacy-law-set-to-take-effect/ , https://globallawexperts.com/israels-privacy-reforms-bite-2026-expanded/ , https://edlaw.eduverse.com/docs/jurisdiction/nat/il/protection-of-privacy-law

**Apple App Store.**
- *1.3 Kids Category:* no links out or purchases except behind a parental gate; "should not include third-party analytics or third-party advertising."
- *5.1.4(a):* birthdate/parental contact only for statutory compliance; apps "intended primarily for kids should not include third-party analytics or third-party advertising."
- *5.1.4(b):* apps that collect minors' info need a privacy policy and must comply with children's privacy laws; **"Apps not in the Kids Category cannot include any terms in app name, subtitle, icon, screenshots or description that imply the main audience for the app is children."**

Source: https://developer.apple.com/app-store/review/guidelines/ , https://techcrunch.com/?p=1880829

**Google Play Families policy.** Declaring a target audience that includes children triggers the Families policy. Ads must come only from self-certified Families ad SDKs, the advertising ID must not be sent for children or users of unknown age, and violations can lead to removal. Sources: https://support.google.com/googleplay/android-developer/answer/9893335 , https://support.google.com/googleplay/android-developer/answer/12918983 , https://support.google.com/googleplay/android-developer/answer/9285070

### 3.3 Recommendations: what NOT to do with kids

- **Don't list in the Apple Kids Category**, and in Google Play don't declare under-13 as the primary target audience. Position as "for coaches and parents". Keep marketing screenshots adult-facing (5.1.4(b)).
- **No child-held personal links in kids groups.** The coach or a parent responds for the child (the Heja model). Allow multiple guardians per child.
- **No peer ratings among children, and no public rankings, leaderboards, standings, or "worst player" signals.** Ratings for team balancing are **coach-only and never shown** (only used to balance). No MVP vote by children; if anything, a coach-awarded "star of the day" that rotates.
- **Minimal data by default:** first name or nickname, birth year (for presets), position preference. **No photos by default** (opt-in by parent), no phone or email of the child, no location history.
- **No ads and no third-party analytics/SDKs** in kids groups (or anywhere, which is simpler).
- **Player cards for kids:** no numeric ratings shown; show attendance, goals (optional), fun badges.
- **Data retention:** auto-delete kids groups after a season of inactivity; parent can delete the child profile.
- **Group visibility:** members of a kids group see only first names; no cross-group discovery.

Sources (§3.1): https://help.heja.io/en/articles/5098616-adding-another-parent-guardian , https://justuseapp.com/en/app/755596884/spond/reviews , https://g2.com/products/teamsnap/reviews , US Soccer PDI PDF https://cdn4.sportngin.com/attachments/document/c1af-1827427/US_SOCCER_PDI_INITIATIVES.pdf , https://knebworthfc.co.uk/youth-advice/

---

## 4. Youth match formats by age (presets)

### 4.1 US Soccer – Small-Sided Games standards (mandated for US Soccer members since Aug 2017)

From the official US Soccer chart reproduced in the PDI document:

| Age | Players | Field (yards) L × W | Max goal (ft) | Ball | Game time | Offside |
|---|---|---|---|---|---|---|
| U6 | 4v4, no GK | 25–35 × 15–25 | 4 × 6 | 3 | **4 × 10 min** | No |
| U7 | 4v4, no GK | 25–35 × 15–25 | 4 × 6 | 3 | 4 × 10 | No |
| U8 | 4v4, no GK | 25–35 × 15–25 | 4 × 6 | 3 | 4 × 10 | No |
| U9 | 7v7 incl. GK | 55–65 × 35–45 | 6.5 × 18.5 | 4 | **2 × 25 min** | Yes (build-out line) |
| U10 | 7v7 incl. GK | 55–65 × 35–45 | 6.5 × 18.5 | 4 | 2 × 25 | Yes |
| U11 | 9v9 incl. GK | 70–80 × 45–55 | 7 × 21 | 4 | **2 × 30 min** | Yes |
| U12 | 9v9 incl. GK | 70–80 × 45–55 | 7 × 21 | 4 | 2 × 30 | Yes |

*U13+ is **not on the US Soccer chart**. From general knowledge, verify: 11v11, full-size field, 8 × 24 ft goal, ball 5 (some U13 leagues use 4), 2 × 35 up to 2 × 45 depending on age and league.*

PDI philosophy (best practice, not mandated): 4v4 – no results or standings, no tournaments. 7v7 – roster ≤12, ≤1 game/day, every player ≥50% playing time. 9v9 – roster ≤16, ≥50% playing time, no results or standings, tournaments without champions. (US Soccer also bans heading for U11 and younger and limits it for U12–U13; this comes from the 2015 concussion initiative, from general knowledge, so verify.)
Source: https://cdn4.sportngin.com/attachments/document/c1af-1827427/US_SOCCER_PDI_INITIATIVES.pdf , https://nyswysa.org/us-soccer-mandates/nyswysa-statement-of-clarification-on-ussf-player-development-initiatives

### 4.2 England (The FA / England Football)

**Current formats (from 2026-27), England Football:** U7 **3v3** (new) · U8–U9 **5v5** · U10–U11 **7v7** · U12–U13 **9v9** · U14+ **11v11**. These are maximums; smaller formats are allowed at any age. This moves each step back one year from the previous pathway (5v5 U7–8, 7v7 U9–10, 9v9 U11–12, 11v11 U13+).
Source: https://learn.englandfootball.com/articles-and-resources/coaching/resources/2022/What-is-a-format-in-football

**Match lengths (FA youth rules as published for 2015/16; may be outdated, verify against the current FA Standard Code of Rules for Youth):** U7–U8 40 min (max 40/day) · U9–U10 50 min (max 60/day) · U11–U12 60 min (max 100/day) · U13–U14 70 min · U15–U16 80 min · U17/adult 90 min. Ball: size 3 (U7–U9), 4 (U10–U14), 5 (U15+). Pitch (FA recommended): 5v5 ≈ 37 × 27 m; 7v7 ≈ 55 × 37 m; 9v9 ≈ 73 × 46 m.
Sources: https://knebworthfc.co.uk/youth-advice/ , https://www.thefa.com/-/media/files/thefaportal/governance-docs/rules-of-the-association/2025-26/38---goalpost-and-pitch-sizes-and-line-marking.ashx , https://www.sportsequip.co.uk/fa-recommended-football-pitch-sizes

### 4.3 Israel (IFA)

**Not verified.** No IFA document with children's league formats or durations was found. The IFA championship regulations say the league committee sets special rules for children's leagues ("ליגה לילדים", "טרום ליגה לילדים"). The only data point found is "תחרותית לייט" (a non-official league run *with* the IFA for grades 4–10): **2 × 15 min**. Youth (נוער) plays 2 × 45. Recommendation: ship US/FA presets plus a fully custom option, and ask an Israeli youth coordinator before shipping an "IFA" preset.
Sources: https://www.football.org.il/files/SiteCollectionDocuments/FTP/eitan/takanon/new%20site/2020/9.20/alifot.pdf , https://www.one.co.il/Article/532426.html

### 4.4 Suggested presets

- **Adult pickup:** 5v5 / 6v6 / 7v7 / 8v8; 1 × 8–12 min with 3 teams winner-stays; or 2 × 25–45.
- **Kids (US Soccer):** "U6–U8 4v4, 4×10" · "U9–U10 7v7, 2×25" · "U11–U12 9v9, 2×30".
- **Kids (England Football 2026-27):** "U7 3v3" · "U8–U9 5v5" · "U10–U11 7v7" · "U12–U13 9v9". Durations: don't map the old age-keyed table onto the new ages. If needed, key them by **format** instead (5v5 → 40 min, 7v7 → 50, 9v9 → 60, from the 2015/16 rules, unverified) or leave England presets without a duration and make it editable.
- Show a gentle note in kids presets: equal playing time and no standings recorded.

---

## 5. Path from PWA to the app stores

### 5.1 Wrapping options

| Option | Android | iOS | Notes |
|---|---|---|---|
| **TWA (Trusted Web Activity) via Bubblewrap / PWABuilder** | Yes, the PWA runs in Chrome full-screen; needs `/.well-known/assetlinks.json` with the signing key's SHA-256 so the URL bar disappears | No | Cheapest for Android; content updates instantly with the web deploy; web push works as in Chrome. |
| **PWABuilder iOS package** | – | WKWebView shell | Same 4.2 risk as any wrapper; little documentation found. |
| **Capacitor** | Yes | Yes | Same web code + native plugins (push via APNs/FCM, haptics, share sheet, contacts, Live Activities via custom plugin). The best route to clear Apple 4.2. |

Sources: https://www.thinktecture.com/en/pwa/twa-bubblewrap , https://web.dev/using-a-pwa-in-your-android-app?hl=ja , https://spacenexus.us/blog/play-store-launch-checklist-pwa-twa-android

### 5.2 Apple guideline 4.2 (minimum functionality) risk

- 4.2: an app should "elevate it beyond a repackaged website"; 4.2.2 bans apps that are mainly web clippings or link collections.
- Field reports: reviewers rejected wrappers even with push, Core Location and sharing ("not robust enough"). One developer passed after adding substantial native functionality.
- **Native features that fit this product (ideas):** a **Live Activity / lock-screen and Dynamic Island match clock**, haptic and sound alerts at half-time and end, a native share sheet into WhatsApp, contacts import to invite players, home-screen widgets ("next game: 14/20 signed up"), offline match clock, native push for "you're in / you're off the waitlist", Apple Watch clock (later).
- Also 2.5.2: keep remote web updates to bug fixes and content; don't change the app's purpose.

Sources: https://developer.apple.com/app-store/review/guidelines/ , https://developer.apple.com/forums/thread/812889 , https://scribe.disroot.org/post/7369014 , https://tanstack.com/intent/registry/%2540capgo%252Fcapgo-skills/capacitor-apple-review-preflight

### 5.3 Costs and accounts

- Apple Developer Program: **$99/yr**. Google Play: **$25 one-time**.
- **Google Play testing rule:** personal developer accounts created after Nov 13, 2023 must run a **closed test with ≥12 testers opted in continuously for 14 days** before applying for production; review takes about a week. **Organization accounts are exempt** but need a D-U-N-S number. Your own football group can be the 12 testers.
  Source: https://support.google.com/googleplay/android-developer/answer/14151465
- Store fees: Apple and Google take 15% (small business / subscriptions after year 1) to 30% on **digital** IAP only.

### 5.4 Sign-in, privacy and deletion requirements

- **Apple 4.8 Login Services:** an equivalent privacy-focused login (Sign in with Apple qualifies) is only required if you use third-party/social login for the primary account. **Personal links / group codes with no social login means 4.8 doesn't apply.** If Google login is ever added, add Sign in with Apple too.
- **Apple 5.1.1(v):** "If your app doesn't include significant account-based features, let people use it without a login", which matches the no-account model. **If the app supports account creation, it must offer in-app account deletion.** A personal-link player profile probably counts, so ship "Delete my data" in-app (player) and "Delete group" (organizer).
- **Google Play:** apps that enable account creation must offer deletion **in-app and through a public web link**, entered in the Data safety form; deactivating doesn't count. Source: https://support.google.com/googleplay/android-developer/answer/13327111
- **Privacy policy:** required by both stores (and by 5.1.4(b) for minors). Host it at a stable URL in Hebrew and English.
- Apple 5.1.1: don't require personal info unless it's core (phone number shouldn't be mandatory).
- **User-generated content (Apple 1.2):** if there is free-text (chat, MVP comments, nicknames), expect to need report/block and a way to hide content.

### 5.5 Push notifications: iOS PWA vs native

- iOS web push works **only for home-screen-installed web apps** (iOS 16.4+), not in Safari tabs; the permission prompt needs a user tap. Declarative Web Push arrived in iOS/iPadOS 18.4 (Mar 2025).
- **iOS 26:** every site added to the Home Screen opens as a web app by default, which makes installing easier, but most non-tech users still won't do it.
- **Implication:** for users who aren't tech-savvy, **WhatsApp sharing stays the reliable reminder channel**; native push via the wrapped app is the main real gain from going to the App Store.
- **Identity risk (test item):** iOS home-screen web apps likely keep **storage separate from Safari** (not confirmed in this research). If the personal-link token lives only in Safari's localStorage, the installed app will open "logged out". Keep the identity token in the URL (the personal link itself) so opening the link restores identity, and test on real iOS.

Sources: https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications , https://progressier.com/pwa-capabilities/declarative-web-push , https://docs.webengage.com/docs/web-push-for-ios , https://heise.de/-10749652 , https://www.macrumors.com/2025/06/18/safari-changes-on-ios-26/

---

## 6. Monetization

### 6.1 What the category does

| Model | Examples | Price points |
|---|---|---|
| Free app, fee on payments | Spond | US $1 + 3.29% / EU €0.20 + 2.5% per item |
| Free + ads, paid removes ads | TeamSnap, SportEasy, SportMember, TeamStats | Ad-free $2.49–$7.99; SportMember team £4.49/mo |
| Per-team organizer subscription (players free) | BenchApp Pro, Heja Pro, SportEasy Premium, TeamStats | $9/mo or $99/yr; $13.49/mo or $99.99/yr; €9.99/mo or €69/yr; €6–15/mo |
| Organizer SaaS + transaction fee | OpenSports | $30/mo + 3% + Stripe |
| Per-player game fee (marketplace) | Footy Addicts, Plei | £5–7.50 / $5–14 per game |
| Venue SaaS | Plei (≈$199/mo), Playtomic | – |
| Player-paid micro-subscription | Pickleheads Plus (~$1/mo, unverified) | – |

### 6.2 Lessons from reviews

- **Ads are the #1 complaint** (TeamSnap even on paid plans, "ads shown to youth"; Spond and SportMember criticized). With kids involved, ads also trigger Apple 1.3/5.1.4 and Google Families constraints, so **don't use ads at all**.
- **Never paywall what players touch** (RSVP, availability, calendar). TeamSnap's paid availability and Heja's calendar-sync paywall drew backlash; Heja reversed it.
- **Processing fees on small weekly games feel expensive** to players and organizers (BenchApp user: $14.70/week for 10 players; Spond US: $1 + 3.29% would be ≈ $1.33 on a $10 game).

### 6.3 Recommended model

1. **Free forever for players and for the core organizer loop** (signups, list paste, team draw, clock, MVP). This drives growth through WhatsApp virality.
2. **Organizer "Pro" (optional), about $3–6/mo or $25–50/yr per group** (Israel: about ₪15–20/mo or ₪99–149/yr), priced under BenchApp and Heja. Possible Pro features: multiple groups and venues, 3+-team rotation and tournament mode, season stats and history export, custom player-card designs, co-admins, automated reminders, kids-club pack (several squads per coach). Consider "group pays together" (one player sponsors the group).
3. **Game-fee collection: deep links first, processing later.**
   - **US:** Venmo officially documents payment links: `venmo.com/<username>?txn=charge&amount=10&note=Football%20Tue` (also `txn=pay`, `recipients=`, `audience=`). Add Cash App ($cashtag/amount) and PayPal.me/amount links (formats from general knowledge, not researched). No fees, no money transmission, no licensing.
   - **Israel:** **PayBox** supports group pots and business payment links/QR. **Bit** has **no public deep-link/API**; integrations go through licensed gateways (PayMe, Hyp) or Bit's personal QR (Jan 2024). For now: show the organizer's Bit phone and amount with a copy button, plus an optional PayBox group link.
   - Pair this with a **"who paid" checklist** (self-mark "I paid" plus organizer confirm), and debt carried across weeks.
   - Later, if processing is offered (Stripe Connect Express: about $2 per monthly active connected account + 0.25% + $0.25 per payout, on top of card fees), make it an organizer choice with fees shown up front.
4. **Sponsored venues and local partners (later):** featured pitch-booking links, sports-store discount on the player card, "kit sponsor" on the MVP card. These are only safe in adult groups, never in kids groups.
5. **App-store billing rule:** game fees pay for a **real-world service** (pitch rental, consumed outside the app), so external payment is allowed and Apple/Google take no cut (Apple 3.1.3(e), services "consumed outside of the app"). Don't rely on 3.1.3(d): it says "one-to-few and one-to-many real-time services must use in-app purchase," and that is aimed at digital live services, not physical games. The safest position is that the app only shows Venmo/PayBox/Bit details and never processes money itself. A **Pro subscription is digital**, so inside the iOS/Android app it needs Apple IAP / Google Play Billing (15–30%). The common workaround is selling Pro on the web; check the current US link-out rules after Epic v. Apple (2025) before relying on in-app links to web checkout.

Sources (§6): https://help.spond.com/app/en/articles/118091-payments-costs-in-the-spond-app , https://benchapp.com/pricing , https://apps.apple.com/us/app/heja/id1157335714 , https://opensports.ca/pricing , https://venmo.com/paymentlinks , https://www.ynet.co.il/articles/mobile/0,7340,L-5643734,00.html , https://www.mako.co.il/finances-news/Article-3a2f2532b660a91027.htm , https://www.hamichlol.org.il/Bit , https://help.payme.io/hc/en-us/articles/360013964399-Alternative-Payment-Method-Bit , https://developers.hyp.co.il/pay/common-use-cases/digital-wallets , https://support.stripe.com/questions/monetizing-payments-with-stripe-connect , https://www.producthunt.com/p/locker-lounge-pickup-soccer-sorted/locker-lounge-pickup-soccer-sorted , https://developer.apple.com/app-store/review/guidelines/

---

## 7. Open questions and gaps

- Israeli FA children's formats and durations (ask a local youth coordinator).
- Current FA youth match-length table (the 2015/16 table may be outdated under the 2026-27 format shift).
- Whether a personal-link profile legally counts as an "account" for Apple 5.1.1(v) and Google's deletion policy (assume yes).
- iOS home-screen storage isolation versus Safari: test on a real device.
- Current Epic v. Apple link-out rules for selling Pro on the web from the iOS app.
- COPPA, GDPR-K and Amendment 13 treatment of coach-entered child data: legal review before kids mode launches.
- No Reddit or Israeli forum sentiment was gathered; a short survey of 10–20 Israeli organizers on WhatsApp workflow and payment (Bit vs PayBox vs cash) would add a lot.
