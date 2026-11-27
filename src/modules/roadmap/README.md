---
name: 'Roadmap'
type: module
summary: 'the public plan page.'
aliases: ['plan page', 'missions']
relationships: []
---

# Roadmap

The public plan page: milestones (missions), then epics (projects), then issues, read from GitHub on a schedule. There is no collection and nothing in the CMS: GitHub is the only source, so nothing can drift. The pages are static and refresh hourly; the screens are in the [screens reference](../../../docs/reference/routes.md).

## Screens

| Screen                 | Route                                        | Data comes from                                                            |
| ---------------------- | -------------------------------------------- | -------------------------------------------------------------------------- |
| The plan               | `/roadmap`                                   | `getPlan` (GitHub milestones, epic issues and their sub-issues)            |
| One mission            | `/roadmap/missions/[number]`                 | the same plan, `getMission`; the number must be a milestone the plan lists |
| One issue              | `/roadmap/[number]`                          | the same plan, `getPlanIssue`; the number must be one the plan shows       |
| One issue, in a dialog | `/roadmap/[number]` from a click on the plan | the same page's content (`IssueDetail`), shown in a dialog over the plan   |

## How the pieces link

- **One read, three views.** `getPlan`, `getMission` and `getPlanIssue` all read the same plan from `data/github.ts` (GitHub's REST API; `GITHUB_READ_TOKEN`, read-only, lifts the 60 reads an hour of an unauthenticated call). The pure rules in `domain/` turn it into what each screen shows.
- **The dialog and the page share `IssueDetail`;** the dialog is an intercepting route (`src/app/(frontend)/roadmap/@modal`), so a direct visit, a refresh or a shared link shows the issue's own page. Both get their title and "do not index" rule from `planIssueMetadata`.
- **Libraries doing real work:** `markdown-to-jsx` draws the issue text (`ui/IssueMarkdown.tsx`); GitHub supplies the data.
- **Charts and maps** are the shared kit's `AreaChart`, `HeatMap` and `PeriodNav` ([charts note](../../platform/ui/chart/README.md)); this module only prepares their numbers (`domain/series.ts`, `domain/stats.ts`, `domain/mapWindow.ts`).

## Behaviors and events

- **The page is static and re-renders every hour** (`PLAN_REVALIDATE_SECONDS`) and asks search engines not to index it. If GitHub cannot be read at run time the render fails, so the last good page stays; during `next build` the plan is empty. A wrong token makes GitHub answer 401 and the first render fail ([project facts](../../../docs/project.md)).
- **Pull requests are dropped:** GitHub lists them with issues. The plan page's one heading is "What we’re building", in the shared page header with no small label above it; projects not yet in a mission follow in their own group, then a "Tell us" button for anything missing (`src/app/(frontend)/roadmap/page.tsx`, `ui/PlanTiles.tsx`; `ui/PlanTiles.test.tsx`, #1082, #1106).
- **The plan page** shows the missions freshest first, each with its progress, a quiet-or-not dot and its week as a heat map, then a four-week summary (three graphs and an activity map that is also the day filter) (`ui/PlanTiles.tsx`, `ui/PlanSummary.tsx`). On a phone each mission is a closed box (`ui/MissionAccordion.tsx`).
- **A mission page** lists one box per project, each opening to its week and its issues; titles drop the type prefix developers add ("feat:", "fix(ui):") (`ui/MissionPage.tsx`, `domain/title.ts`).
- **Clicking an issue** opens it in a dialog; close, Escape and the browser's back button return to the plan where it was (`ui/IssueDetail.tsx`, #946).

## Shared pieces it uses

- Kit: `Card`, `Disclosure`, `ProgressBar`, `Badge`, `EmptyState`, `Button`, `Link`, `Text`, `AreaChart`, `HeatMap`, `PeriodNav`; `formatDateTime` and the site timezone from `src/platform/lib`; `notIndexed` from `src/platform/seo`.
- Where it meets other modules: none. The routes in `src/app/(frontend)/roadmap/` compose it.

## Rules and the tests that protect them

- **What is screened out, and never counted as shown:** issues labeled `infra` or `needs owner`, and any whose title or text holds a server address, an email address or a plug-and-play plan. A screened epic takes its sub-issues with it; a milestone left with no shown epic is not listed and returns by itself; a milestone whose title or description fails the screen shows as "Milestone N" with no description; label names are screened too, in any case. It is best effort (IPv4 and plain email addresses, not every spelling) and the page says how many issues are not shown (`domain/screen.ts`, `domain/plan.ts`; `domain/screen.test.ts`, `domain/plan.test.ts`).
- **A screened, unknown or malformed number answers 404,** so a screened issue cannot be reached by its address (`use-cases/getPlanIssue.ts`; `domain/paths.test.ts`).
- **Mission order follows the latest activity:** the latest of an issue's close and its last change on GitHub, across the mission's issues, most recent first; missions with no dates last (`domain/activity.ts`, #1125; `domain/activity.test.ts`). Activity is counted in weeks while at least half of the last 8 weeks are busy (3 or more finished issues across the plan), then months over 6, then years over 3.
- **Daily figures:** issues finished per day, the running total done, and how many were open when each day ended, for the whole plan or any group; days are the site's calendar, a quiet day is zero, issues closed as not planned are in none of them, and an issue with no open date counts as open from before the first day (`domain/series.ts`, `domain/stats.ts`, #1189; `domain/series.test.ts`, `domain/stats.test.ts`).
- **Month browsing:** the activity map starts on the last four weeks; arrows step a whole calendar month back, as far as the first activity, and forward again; the three graphs stay on four weeks and days chosen stay chosen (`domain/mapWindow.ts`, #1218; `domain/mapWindow.test.ts`).
- **The day filter:** nothing is chosen on load, so the page and the page without scripts show the whole plan. A chosen day shows only issues opened or finished on it, and missions and projects with none are hidden. The top commands the lower levels: under one chosen day that day is fixed; under several only those days can be pressed; a level with no pick follows the level above and counts only the days that are on (`domain/dayFilter.ts`, `domain/filterPlan.ts`, #1204; `domain/dayFilter.test.ts`, `domain/filterPlan.test.ts`).
- **Issue text is Markdown shown safely:** raw HTML appears as text, only web links open (in a new tab), images show their description, task lists read "Done" or "Not done", no issue heading becomes the page's h1 (`ui/IssueMarkdown.tsx`).
- **State marks** are green open, purple done, gray not planned, each with words and an icon (`ui/IssueBadges.tsx`, #946).

## Boundaries

- Entry files: `index.ts` (types and pure rules, safe for clients and scripts) and `server.ts` (reads and components). Layers: `domain/`, `use-cases/`, `data/`, `ui/`; it imports no other module (`eslint.boundaries.config.mjs`).

## Decisions

[0008](../../../docs/architecture/decisions/0008-compose-modules-at-the-app-level.md) (the app composes modules); the page's design history is on issues #946, #1082, #1125, #1189, #1192, #1193, #1204, #1218.

## Known gaps

- The screen is best effort and misses unusual spellings of addresses (`domain/screen.ts`).
- Without a token, an hourly refresh of a larger plan can pass GitHub's 60 reads an hour.
