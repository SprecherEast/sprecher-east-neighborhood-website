# Content Marketing & Community Research

Operational instructions for the A-Content (Content & Voice) and B-Research (Research & Quality) agents. It lives here now; the archived strategy repo is only history.

## Weekly Blog Post Workflow

The Content Agent produces at least one blog post per week (additional posts on demand as news warrants) following this cadence:

| Day          | Phase                | Activities                                                                                                                                                                                                    |
| ------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monday AM    | Source Review        | Review RSS feeds (Fri-Sun backlog), scan social media, identify 2-3 lead stories + 3-4 supporting insights, document source URLs                                                                              |
| Monday PM    | Story Development    | Answer "why does this matter to Sprecher East?", research background, outline post structure                                                                                                                  |
| Tuesday AM   | Draft                | Write a post within the length budget in [brand voice](brand-voice.md) (news posts under 300 words). Structure: **Hook** > **Context** > **Sprecher East Angle** > **Action**. Include 2-3 source links + CTA |
| Tuesday PM   | Review               | Self-edit for clarity, tone, accuracy. Fact-check all links and quotes. Refine headline                                                                                                                       |
| Wednesday AM | Stakeholder Review   | Share draft with 1-2 board members for feedback (if time permits)                                                                                                                                             |
| Wednesday PM | Publish & Cross-Post | Publish via CMS, create platform-specific social versions, tag relevant accounts                                                                                                                              |
| Thursday     | Engagement           | Respond to comments/replies, share to email list, note engagement metrics, begin next week's research                                                                                                         |
| Friday       | Metrics & Planning   | Document weekly metrics, identify what resonated, preliminary research for next post                                                                                                                          |

## Blog Post Structure

Every post follows this template:

1. **Hook** — Why this matters to you (the resident). Lead with relevance, not background.
2. **Context** — What's happening. Factual, sourced, neutral.
3. **Sprecher East Angle** — How it specifically affects our neighborhood.
4. **Action** — What residents can do: join forum discussion, attend event, contact alderperson, share, etc.

Requirements:

- Within the length budget in [brand voice](brand-voice.md) (news posts under 300 words), conversational and accessible tone
- 2-3 embedded links to official sources or previous posts
- Every post ends with a call-to-action
- Optional: photo, neighborhood map, or graphic

## Content Calendar — 4-Week Theme Rotation

| Week | Theme                         | Example Topics                                                                                   |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------ |
| 1    | City & Development            | East Towne redevelopment, housing projects, road improvements, transit plans, zoning decisions   |
| 2    | Safety & Community            | Vehicle theft trends, police programs, neighborhood watch, safety resources, community events    |
| 3    | Property Values & Livability  | Property value trends, park improvements, school updates, local business openings                |
| 4    | Civic Engagement & Government | Alderperson updates, how to speak at council, resident success stories, upcoming public hearings |

Repeat monthly with new stories per theme. Adjust seasonally (winter safety, spring cleanups, summer events, fall planning).

## Content Tone & Voice

- **Tone:** Informative, optimistic, community-focused, accessible
- **Audience:** Sprecher East residents of all ages and backgrounds
- **Avoid:** Partisan politics, sensationalism, negativity without solutions, jargon
- **Embrace:** Local pride, practical information, calls to action, and neutral reporting of decisions (no "wins" or "losses", see brand voice)
- **Brand:** Always "Sprecher East" — never abbreviations. For AI transparency and disclosure requirements, follow the canonical guidance in [`components-and-content.md`](components-and-content.md).

## RSS Feeds — Research Agent Monitoring List

These feeds are checked by the B-Research agent during Monday source review:

| #   | Source                   | Feed URL                                      | Focus                                              | Frequency |
| --- | ------------------------ | --------------------------------------------- | -------------------------------------------------- | --------- |
| 1   | Madison.com              | `https://madison.com/search/?f=rss&t=article` | City government, development, neighborhood news    | 3x/week   |
| 2   | Capital Times            | `https://captimes.com/feed`                   | City council, political analysis, community issues | Weekly    |
| 3   | Channel 3000 (WISC-TV)   | `https://www.channel3000.com/rss`             | Breaking news, public safety, weather              | As needed |
| 4   | Spectrum News WI         | `https://spectrumnews1.com/wi/madison/rss`    | Local events, government announcements             | 3x/week   |
| 5   | Dane County Gov          | `https://www.danecounty.gov/press`            | County infrastructure, health, regional            | Bi-weekly |
| 6   | City of Madison Planning | `https://www.cityofmadison.com/dpced`         | Neighborhood plans, permits, District 16           | Bi-weekly |
| 7   | Madison365               | `https://madison365.com`                      | Community events, cultural happenings              | Weekly    |

## Social Media Monitoring Schedule

| Source                     | Platform  | Handle / URL                                                           | Check Frequency |
| -------------------------- | --------- | ---------------------------------------------------------------------- | --------------- |
| Nextdoor — Sprecher East   | Nextdoor  | `nextdoor.com/neighborhood/sprechereast--madison--wi` (login required) | Daily (AM + PM) |
| Sprecher East NA page      | Facebook  | `facebook.com/SprecherEast`                                            | Daily           |
| City of Madison            | Twitter/X | `@cityofmadison`                                                       | Daily           |
| Madison.com                | Twitter/X | `@madison_dot_com`                                                     | Daily           |
| District 16 Alder          | Web       | `https://www.cityofmadison.com/council/district16`                     | 3x/week         |
| Madison Police             | Twitter/X | `@madisonpolice`                                                       | 3x/week         |
| East Towne Business Groups | Facebook  | Search East Towne Business Association or similar                      | 1x/week         |

## Government Channel Monitoring

| Source                        | URL                                           | Focus                                                                                                     | Frequency                    |
| ----------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------- |
| City Council Agenda & Minutes | `https://www.cityofmadison.com/clerk`         | Upcoming votes, neighborhood proposals                                                                    | Every Tuesday + post-meeting |
| City Neighborhood Directory   | `https://www.cityofmadison.com/neighborhoods` | Liaison updates, city initiatives                                                                         | Bi-weekly                    |
| Dane County Board             | `https://www.danecounty.gov` (Board agendas)  | Regional infrastructure, county initiatives                                                               | Bi-weekly                    |
| Madison Schools               | `https://www.madison.k12.wi.us`               | Schools by address: MMSD Find Your School (`https://webapp1.madison.k12.wi.us/webapp1/find_your_school/`) | Weekly                       |

## Success Metrics (PostHog — when configured)

Track these metrics to measure content effectiveness:

**Weekly:**

- Blog: unique page views per post, average time on page, CTR to linked resources, comments
- Social: reach/impressions, engagement rate (likes/shares/comments), CTR to blog, follower growth

**Monthly:**

- Forum: new sign-ups from blog/social referral, discussions sparked by posts, total active users

**Quarterly:**

- Aggregate across 12 weeks, identify top themes, adjust calendar, assess impact on neighborhood initiatives

**12-week targets:** 150 unique visitors/post, 10-15 social shares+comments/post, 50% forum member increase from baseline.

## Sources: every factual claim must be checkable

Every factual claim on the site can be traced to a source a neighbor can open. This applies to every
agent and person who writes content.

| Needs a source                                       | Doesn't need one                     |
| ---------------------------------------------------- | ------------------------------------ |
| Boundaries, districts, schools, park sizes           | A welcome or a thank-you             |
| Dates, times, votes, costs, any statistic            | Our own policies (free, no sign-up)  |
| Any official designation or what a city body decided | Opinions clearly labeled as opinions |

- Prefer the official page (City of Madison, WisDOT, Dane County) over a news story about it.
- A longer piece links its sources in the text or ends with a short "Sources" list, and says when
  it was last checked.
- If a claim can't be sourced, leave it out or label it as unverified. Never publish a guess.
- The independent reviewer checks sources before anything goes live
  ([`pr-review`](../../.agents/skills/pr-review/SKILL.md) for code; the editor's own check for content).

## Agent Coordination

| Agent       | Role in Content Workflow                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| A-Content   | Primary owner: research, synthesis, drafting, publishing, engagement tracking                                                        |
| B-Research  | Source monitoring, RSS feeds, government channels, fact-checking, source verification, brand safety review, sensitive info screening |
| C-Builder   | CMS publishing support, website performance, technical requirements                                                                  |
| D-Community | Interview opportunities, resident quotes, event info, direct outreach amplification                                                  |
