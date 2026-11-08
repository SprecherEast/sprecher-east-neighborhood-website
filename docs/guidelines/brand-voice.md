# Sprecher East voice (default)

How the site sounds wherever it speaks: messages, emails, posts, events, explainers. Everyone who
writes for the site, person or agent, reads this first. Facts come from sources; this file only
decides how we say them.

## Who we sound like

A neighbor who lives here. We drive Sprecher Road and Cottage Grove Road every day, know the way to
Door Creek Park and Pinney Library, and notice when the season turns. We talk to anyone the
same way: kindly, plainly, and fast. We can be funny when the moment is light and quiet when it
isn't. On money, taxes and politics we're the steady neighbor who reads the documents and tells you
what they say, without telling you what to think.

## Six things we are

| We are                              | Not                            | Why                                                        |
| ----------------------------------- | ------------------------------ | ---------------------------------------------------------- |
| **Warm**, familiar                  | Corny, chummy, forced slang    | Neighbors trust a friendly voice; they tune out an act.    |
| **Brief**, first line does it       | Curt, or padded                | Most people skim on a phone and leave after a sentence.    |
| **Plain**, everyday words           | Dumbed down or talking down    | Experts want plain words too. Clear is respectful.         |
| **Steady** on money & politics      | Stirred up, cheering, scolding | Neighbors disagree; the facts should be the same for all.  |
| **Local**, from verified facts      | Generic, or guessed            | Real places make it ours. A wrong place breaks trust.      |
| **Honest**, says what we don't know | Hedged, or overconfident       | "We're checking" builds more trust than a confident guess. |

## The "we" rule

- **We** is the neighborhood and this site. **You** is the reader. We don't write "I", even for
  the owner or a volunteer, except a signed piece that says who wrote it.
- **We never borrow someone else's action.** The City decided it, not "we". We reported a broken
  streetlight only if someone actually did.
- **We don't speak for every neighbor.** "Many of us walk Door Creek Park", not "we all love it".

## Kind when we ask

Whenever we ask a neighbor for something (feedback, a reply, a sign-up, a correction), we ask the
way a good neighbor would: politely, with a please or a thanks, and as an invitation, not an order.
A bare command ("Tell us", "Sign up now") is rewritten. This is warmth, not padding: the polite
word replaces nothing and stays inside the length budget.

## Length budget

| Piece                               | Limit                                                                                                                                                                                                                                                                                           |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Headline                            | The title is never over 60 characters: publishing refuses more. Says the news, not a teaser.                                                                                                                                                                                                    |
| Lead (first sentence)               | 25 words max. Answers "what is it, and what do I do?"                                                                                                                                                                                                                                           |
| Card summary                        | 1 or 2 sentences, under 160 characters, no links.                                                                                                                                                                                                                                               |
| Site message (form, error, success) | 1 or 2 sentences, 20 words ideally, 30 max.                                                                                                                                                                                                                                                     |
| Email                               | Subject under 50 characters. Body under 120 words, one link to act.                                                                                                                                                                                                                             |
| Event                               | The page shows what a neighbor needs on one screen without scrolling (1080p, 100% zoom): the body you write is short enough to sit beside the header and facts panel. If the layout leaves too little room, shorten the body or fix the layout. Need more? Link to a post or the official page. |
| News post                           | Fits on one screen at 1080p and 100% zoom, with its picture. Longer? Make it an explainer.                                                                                                                                                                                                      |
| Explainer                           | One idea per screen, each with its picture. The page may scroll; no single idea runs longer than a screen.                                                                                                                                                                                      |
| Sentence                            | Average 15 words; split anything over 25.                                                                                                                                                                                                                                                       |

The drafting prompt (`intelligence/prompts/draft.md`) and its schema carry a copy of the event and news rule because the pipeline doesn't load this file. Change them together. The owner chose the screen rule in place of word counts (2026-11-03, voice call with Claude, recorded on #535).

**Say it once.** A title, label or picture that already says it needs no sentence repeating it.
What a list, a card or a chart shows needs no intro. Say the thing once, in one short sentence, or
leave it out.

Over budget? Cut words before facts. If the facts don't fit, split the piece.

## Tone map

Voice stays the same; tone moves with the moment. Humor dial: 0 none, 1 a warm word, 2 a light
line, 3 playful.

| Situation                | Tone                                                       | Humor |
| ------------------------ | ---------------------------------------------------------- | ----- |
| Welcome                  | Glad you're here, no pressure, what to do first.           | 2     |
| How-to, forms, errors    | Calm and exact. What happened, how to fix it. Never blame. | 1     |
| Event                    | Inviting and concrete: when, where, what to bring.         | 2–3   |
| Good news                | Glad, not gushing. Credit whoever did it.                  | 2     |
| Bad news, safety         | Calm, fact first, what to do now, who to call.             | 0     |
| Money and taxes          | Even and exact. Numbers with year and source.              | 0–1\* |
| Politics, city decisions | Neutral process: who decides, when, how to weigh in.       | 0     |
| Holiday                  | Warm, inclusive, short.                                    | 1–2   |
| Correction               | Plain and prominent: what was wrong, what's right.         | 0     |

\*A light welcome line is fine ("Grab a coffee; this one has charts"); never a joke about the money,
a tax, a decision or a person. Humor is never at anyone's expense or about crime, loss, damage or
illness, and goes first when in doubt. Puns and idioms don't translate: one per piece at most. One
exclamation mark per piece at most; none in bad news, money or corrections.

## Money, taxes and politics: neutral, always

We report what was decided, by whom, when, what it costs a sample home, and how to take part. We
never say whether a tax, budget, project or official is good or bad, and we never take a side on a
referendum, a candidate or a budget amendment. Every number has a year, a source and, if we
calculated it, says so. A number only one source reports is labeled "reported by {source}, not yet confirmed" (an exact figure from its official publisher is not an estimate). A number we or the source rounded or projected is called an estimate, and says by whom.

**Sources that differ by rounding agree.** Small differences that come from rounding between
sources are not discrepancies: use the official publisher's figure and don't flag or list the
difference. Only a gap too large to be rounding is flagged as unconfirmed or as a conflict.

**Tripwires.** If one of these appears in our own words, rewrite it (inside a quote, attribute it):

| Tripwire                                                                     | Say instead                                     |
| ---------------------------------------------------------------------------- | ----------------------------------------------- |
| too high, too low, not enough, wasteful, bloated, overdue, finally           | the number, and the change: "up 5.5% from 2026" |
| a win, a loss, good news, bad news, unfortunately, thankfully (about policy) | what happened: "the Council approved"           |
| hike, skyrocketing, soaring, slashed, gutted, cuts (for a smaller increase)  | increase, decrease, "grew less than last year"  |
| only, just, merely, a whopping, massive (before a number)                    | the number alone                                |
| burden, hard-earned, taxpayer money, giveaway, handout, boondoggle           | property tax, City funds, the program's name    |
| invest, investment (as our own word for spending)                            | spend, or "the City calls it an investment"     |
| claimed, admitted, slammed, pushed through, rubber-stamped                   | said, voted, approved                           |
| should, needs to, deserves (about a public decision)                         | "the Council decides", "here's how to comment"  |
| common sense, fair share, controversial (unquoted)                           | describe the positions, attributed              |

**Allowed:** "The proposal is $477.5 million, up 5.5% from 2026 ([City of Madison](https://www.cityofmadison.com/node/127641))." "The City says
the change is about $7 a month for an average home; Isthmus reports about $90 a year" ([City](https://www.cityofmadison.com/node/127291), [Isthmus](https://isthmus.com/news/news/10-bites-from-madison-budget-briefings/)). "Supporters
and opponents spoke at the hearing; the minutes are here." "Here's how to comment by Monday."

## Local awareness

- **Use what neighbors know.** Streets, parks, the library, the stores and places we pass, the
  season, the holidays, the big things happening in town. One local touch per piece is plenty.
- **Only from the verified fact sheet.** A place, business, group, HOA, section or street goes in
  only if the neighborhood fact sheet lists it with its source (today: "Known venues" and the area
  in `intelligence/coverage.md`, and `intelligence/area.yaml`). Not from memory, maps or a guess.
  The one exception is an event's own "where": use the address the organizer's primary source gives, cited, as the verify step does. Spell names as their owner does (Kwik Trip, not "Quick Trip"). Unsure? Leave it out and list it in
  `$.missing`. A store as a landmark is fine; praising or advertising it isn't.
- **Private people are never named**, pictured or described so they can be recognized: not
  neighbors, kids, volunteers or "the family on the corner". Thank people as a group, or with
  their written OK. Officials are named only for what they did in public, with a source.
- **Holidays, inclusively.** Mark civic days and the observances neighbors here celebrate, from a
  sourced calendar. On a holiday's own day, use its own greeting ("Eid Mubarak to neighbors
  celebrating today"). For a season, keep it plural ("Happy holidays, whatever you celebrate").
  Never assume everyone celebrates, and leave room for those who don't.
- **Nearby events and history.** A big concert, a donation drive or trick-or-treat gets a short
  line, a link, or a sourced event or history piece. Its date and hours come from the organizer.

## Explaining complex things

1. **One idea per page or section.** If it needs "and also", it's two sections.
2. **Lead with the answer.** "About half your tax bill goes to schools" before how bills work.
3. **Example before rule.** Show a sample home's bill, then explain mills.
4. **Define a term once, in plain words, where it first appears** (see "Tax term" below).
5. **A picture beats a paragraph.** A chart, icon row or diagram carries the idea; the words point
   to what to notice. Every picture has alt text and the same facts in a table or sentence.
6. **Say what we don't know**, in its own short list, and when we'll check again.
7. **Show the year and source next to every number**, and end with one action.

## Words

| Use                                | Avoid                                                                |
| ---------------------------------- | -------------------------------------------------------------------- |
| neighbors, you, we, Sprecher East  | residents, stakeholders, community members, SENA or any abbreviation |
| use, help, start, about, right now | utilize, facilitate, commence, approximately, at this time           |
| the actual thing: sidewalk, signal | infrastructure, initiative, amenities                                |
| contractions: we're, you'll, it's  | "we are pleased to announce", "please be advised"                    |
| "That email doesn't look right"    | invalid, error, forbidden, failed, illegal                           |
| plain verbs: said, voted, decided  | stated, opined, slammed, claimed                                     |

**Machine-sounding words add length, not facts; cut them:** nestled, vibrant, bustling, hidden gem,
rich tapestry, testament, pivotal, delve, embark, unlock, elevate, seamless, journey, navigate,
foster, leverage, robust, game-changer, "it's important to note", "whether you're X or Y", "not just
X, but Y", endings like "highlighting its importance", lists of three for rhythm, emoji strings.

## Before and after

Examples show the voice only. Events in them are illustrations; never copy a fact from here.

| Case           | Before                                                                                          | After                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Form error     | An account associated with this email address already exists.                                   | Thanks. If that email can be used, we've sent the next step to it. Check your inbox (and spam).                                                     |
| Form error     | Invalid input. Please enter a valid email address.                                              | That email doesn't look right. Check for a missing @ or a typo.                                                                                     |
| Email          | Thank you for contacting the Association. Your inquiry has been received and will be processed. | Got it, thanks. We'll reply to {email} as soon as we can.                                                                                           |
| Welcome        | Welcome to our website. We are dedicated to fostering a vibrant community.                      | Welcome, neighbor. Here's what's on around Sprecher East this week, and how to jump in.                                                             |
| How-to         | To utilize the forum, users must first complete the registration process.                       | To post in the forum, sign up first. Then tap New post.                                                                                             |
| Event          | Join us for an exciting, can't-miss celebration that truly brings our community together!       | Leaf-raking morning, Saturday 10 a.m., Door Creek Park. Bring gloves; we'll bring cider.                                                            |
| Good news      | We are thrilled to announce the amazing completion of the new shelter!                          | The Door Creek Park shelter is substantially complete, the City says. Here's the City's update.                                                     |
| Bad news       | Due to unforeseen circumstances, the event has been cancelled.                                  | We've cancelled Saturday's cleanup: storms are forecast. New date: {date}. Sorry for the short notice.                                              |
| Safety         | ALERT!!! Cars broken into AGAIN. Lock your doors, people!                                       | Police report car break-ins near {place} this week ({link}). Lock up and take valuables inside. Happening now? Call 911.                            |
| Holiday        | Merry Christmas from all of us! (a December note to everyone)                                   | Happy holidays, neighbors. Whatever you celebrate, or if you just enjoy the quiet, we hope it's a good one.                                         |
| Seasonal       | Halloween festivities will occur on the designated evening.                                     | Trick-or-treat is {date}, {hours} ({source}). Porch light on means come on up.                                                                      |
| Tax lead       | Your December property tax bill adds up four taxing bodies, then subtracts a State credit.      | Of every $100 on your December 2025 tax bill, about ${school} goes to the school district and ${city} to the City (our math, from {source}).        |
| Tax term       | The bill applies a mill rate to assessed value.                                                 | A mill is $1 of tax for every $1,000 your home is assessed at.                                                                                      |
| Budget vote    | The mayor's bloated budget hikes your taxes again. Tell the Council enough is enough!           | The Common Council is scheduled to vote on the 2027 City budget on November 10. Here's how to watch or comment.                                     |
| Budget vote    | Finally, a budget that invests in our neighborhood!                                             | The proposed 2027 operating budget is $477.5 million, up 5.5% from 2026 (City of Madison).                                                          |
| Not sure yet   | The new Door Creek Park shelter cost $3.5 million.                                              | What did the shelter cost? We're still checking. A news report says about $3.5 million; the City's page lists no cost.                              |
| Correction     | UPDATE: Incorrect information was previously displayed.                                         | Correction, {date}: we said the City's rate was {old} mills. Its levy table says {new}. We've fixed the chart.                                      |
| Town addresses | Annexation will impose new municipal taxes on Town properties.                                  | If your home is still in the Town of Blooming Grove, it's scheduled to join the City on October 31, 2027. See the City's estimate for what changes. |

## Before publishing: 10 checks

Every piece passes all ten, or it waits. For money, taxes and politics, a second person re-checks.

1. **Voice.** Passes the voice test below.
2. **Facts and sources.** Every claim links a source; numbers have two sources, or say "reported by {source}, not yet confirmed".
3. **Neutral.** No tripwire in our own words; nothing takes a side on money or politics.
4. **Reading level.** Grade 8 at most; messages and leads aim lower.
5. **Length.** Within the budget above; the first sentence works alone.
6. **Inclusive and private.** No private person named; holidays inclusive; nobody is the joke.
7. **Accessible.** Every image and chart has alt text, and every chart has its facts in text or a
   table; links say where they go.
8. **One call to action**, and it's clear.
9. **Honest about us.** Says we're unofficial and that AI helps and neighbors review, where needed.
10. **Numbers re-checked** against the source, by year, right before publishing; computed numbers
    say "our calculation".

## Voice test

Three questions anyone can ask of a draft (or give an AI reviewer with this file):

1. **The sidewalk test.** Would a neighbor say this out loud to you on Sprecher Road? If it sounds
   like a letter from an office or an ad, rewrite it.
2. **The first-line test.** Cover everything after the first sentence. Do you know what it is and
   what to do?
3. **The other-side test.** Give the money or politics part to two neighbors who vote differently.
   If either finds something to object to besides the facts, fix the wording.

## This is the default

This is the default voice that ships with the site. An association can replace it with its own
later; until then, and whenever that custom voice can't be reached, this one applies.

## Where the example figures come from

The numbers in the examples are illustrations, checked 2026-11-03. Never copy one into a piece: look
it up again. 2027 proposed budget: [City page](https://www.cityofmadison.com/node/127641). Door Creek
Park shelter: [City project page](https://cityofmadison.com/parks/projects/door-creek-park-shelter)
(no cost listed) and a [Cap Times report](https://captimes.com/news/community/madison-s-3-new-park-shelters-cost-6-million-to-open-this-spring/article_646acdce-fe90-11ef-836b-d3ba41accae2.html)
($3.5 million). Town of Blooming Grove date: [City](https://www.cityofmadison.com/city-hall/town-of-blooming-grove).
Tax lead and correction examples use {placeholders}: look the real rates up in the City's levy tables when writing (the City's two rate figures are an open question on #647).
