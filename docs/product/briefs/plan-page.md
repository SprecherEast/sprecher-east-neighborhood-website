# Plan page

Status: draft for the owner

- **Purpose:** show neighbors, in the open, what the volunteers are working on and how far along each part is.
- **Audience:** a neighbor who is curious, who wants to know if something they care about is moving, or who is thinking about helping. They arrive from a post or the home page, usually on a phone, and skim.
- **Next step:** tell us what is missing or offer to help (the contact page). The owner decides whether this is the right step.
- **Tone:** warm, plain and honest. Progress is stated as it is, including what is slow or not planned. No insider words: a neighbor should not need to know what a milestone or an epic is.
- **At a glance:** without scrolling, a neighbor can tell whether things are moving, what we are working on now, and how to ask or help.
- **Open questions:**
  - Is "tell us or help" the one next step, or something else?
  - Should the words milestone and epic stay on the page, or become plain names for the same groups?
  - Should the page title name the job ("what we're building") or the thing ("our plan")?

## What is wrong today

Reviewed on the live page, top to bottom (owner's observations, 2026-11-11, plus the review).

- **Title:** a bare label, not a friendly one.
- **Intro:** explains how the page is made and uses insider words (milestone, epic) instead of saying what the neighbor gets.
- **Top numbers:** four equal tiles in one color. Two of them (done this week, done this month) nearly match each other, so they say little. Open and done counts across every task mean nothing to a neighbor.
- **Topic rows:** all look alike, with the same green bar and a dense line of counts. Order follows due dates, not what is active, and nothing says what is next.
- **Labels:** "open" and "done" say little; no row shows change over time.

## Proposed flow, top to bottom (draft)

1. **Title and one promise.** A friendly title, then one sentence on what this page shows.
2. **Is it moving?** One headline, such as what we finished this week, with a small chart of finished work by week over recent weeks. This replaces the four tiles.
3. **Now.** The few things being worked on right now, in plain words, so there is a clear "what is happening".
4. **Topics.** Each group named plainly, with one progress bar, one line on what it means for a neighbor, and a plain status (underway, next, done). Active topics first.
5. **Last line.** An invitation to tell us what is missing or to help (the next step above).

Charts reuse the UI kit's chart component, and the weekly counts come from the dates issues were closed, which the page already has. Whether this flow is right is the owner's call; nothing on the page changes until it is agreed.
