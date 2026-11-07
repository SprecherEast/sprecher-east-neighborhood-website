# Custom Skill Proposal: City Meeting Tracker

**Date:** February 28, 2026
**Author:** [F-RD] R&D Agent
**Recommendation:** Build the **city-meeting-tracker** skill first

---

## Problem

The Sprecher East events calendar requires manual research and updates to stay current with City of Madison meetings. Without automation, the calendar quickly goes stale — the site previously showed only past events from July 2024, which makes the neighborhood look inactive.

## Options Evaluated

### 1. city-meeting-tracker (RECOMMENDED)

**What it does:** Automatically fetches upcoming City of Madison meetings from the Legistar API, filters for meetings relevant to District 16 and the far east side, and updates the events calendar data.

**Why it wins:**

- The Legistar API at `https://webapi.legistar.com/v1/madison/events` is publicly accessible, well-documented, and returns structured JSON
- Proof of concept already validated: our research agent successfully pulled 15+ meetings from the API including Plan Commission, Common Council, Finance Committee, Transportation Commission, and Board of Health
- Directly solves the stale-content problem — the #1 issue across all Madison neighborhood websites
- Can run as a scheduled Claude Code session (weekly) or as a cron job
- Data format maps cleanly to the Events collection's fields

**Implementation plan:**

1. Create a script at `scripts/fetch-meetings.ts` that queries the Legistar API
2. Filter results by body (Common Council, Plan Commission, etc.)
3. Enrich with District 16 relevance notes
4. Also scrape Alder O'Brien's blog at `https://www.cityofmadison.com/council/district16/blog` for local events
5. Write directly into Payload CMS via the Local API
6. Run weekly as a Claude Code session or GitHub Action

**Effort:** ~4-6 hours to build, 30 minutes/week to maintain
**Cost:** Free (Legistar API is public, no API key needed)
**Risk:** Low — API is stable (used by multiple civic tech projects)

### 2. content-reviewer

**What it does:** Checks new content against brand voice guidelines, verifies factual accuracy against official sources, and flags issues.

**Assessment:** Valuable but premature. We don't have enough content volume yet to justify automation. The brand voice guidelines document + manual review by Amine works fine at current scale. Revisit when posting 3+ articles per week.

**Effort:** ~8-10 hours (NLP comparison against guidelines)
**Risk:** Medium — voice matching is subjective and hard to automate well

### 3. neighbor-greeter

**What it does:** Generates personalized welcome messages for new residents who sign up on the website.

**Assessment:** Nice to have but not needed yet. The community has < 50 visitors/month. Welcome messages should feel personal, not automated, at this stage. Revisit when community grows to 100+ active members.

**Effort:** ~2-3 hours
**Risk:** Low but low impact

## Decision Matrix

| Criteria                  | city-meeting-tracker | content-reviewer | neighbor-greeter |
| ------------------------- | -------------------- | ---------------- | ---------------- |
| Solves real problem now?  | Yes                  | No (premature)   | No (premature)   |
| < 1 week to implement?    | Yes (4-6 hrs)        | No (8-10 hrs)    | Yes (2-3 hrs)    |
| Improves content quality? | Yes (fresh events)   | Yes (voice)      | No               |
| Maintenance burden?       | Low (30 min/week)    | Medium           | Low              |
| **SCORE**                 | **Winner**           | Runner-up        | Third            |

## Next Steps

1. Amine approves this proposal
2. Build `scripts/fetch-meetings.ts` with Legistar API integration
3. Test with current month's meetings
4. Set up weekly scheduled run
5. Optional: Add to GitHub Actions as a cron workflow
