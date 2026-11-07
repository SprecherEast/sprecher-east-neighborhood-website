# Component set: area components and coverage

Part of the [UI inventory](inventory.md) (#170). The shared components are in
[component-set.md](component-set.md).

> **Status: approved** by the owner on 2026-10-21, with the merges in
> [component-set.md](component-set.md#how-many-and-what-to-build-first).

## Area components

Each lives in its module's `ui/` and is built from the shared components. Modules never import each
other: where two meet (the header shows the account links; the post page shows upcoming events), the
page or layout in `src/app/` composes them ([0008](../architecture/decisions/0008-compose-modules-at-the-app-level.md)).

| Module      | Component           | Variants (`cva`)                                | Props (plain data)                                                                                                                      | Built from                                                                                                                                                 | Today                                                                                                                                         | Elements   |
| ----------- | ------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `site`      | `SiteHeader`        | one look                                        | `navItems` (resolved links), `account` slot, `current` path                                                                             | `Section · page`, `Link · nav`, `Button`, `Dialog · sheet`; a pulsing placeholder while the account loads                                                  | `src/modules/site/ui/SiteHeaderBar.client.tsx` (desktop and mobile markup written twice)                                                      | L2, S8     |
| `site`      | `SiteFooter`        | one look                                        | `navItems`; hides a column with no links                                                                                                | `Section · page`, `Text · label`, `Link · muted`, `MetaList`                                                                                               | `src/modules/site/ui/SiteFooter.tsx`                                                                                                          | L6         |
| `site`      | `Logo`              | `size`: `md`, `lg`                              | —                                                                                                                                       | —                                                                                                                                                          | `src/modules/site/ui/Logo.tsx`                                                                                                                | L3, L4     |
| `site`      | `PageHero`          | `variant`: `high`, `medium`, `low`              | `PageHeroProps`: `body`, plus `image` and `links` (`ResolvedLink[]`) for `high` and `medium`; `high` draws the first heading as title   | `Media`, `RichText`, `Section` (`medium`, `low`), `Button` by position (`high`), `LinkButton` (`medium`)                                                   | `src/modules/site/ui/PageHero.tsx` (#460; props from `toPageHeroProps`; `none` or an empty hero draws nothing)                                | H1, H4, H5 |
| `site`      | `ContentBlock`      | `layout`: `single`, `columns`, `cards`, `stats` | `ContentBlockProps`: `columns` (`{ size, body, link? }[]`), or `groups` of cards under a title for `cards`; the mapper picks the layout | `Section · sm`, `CardGrid`, `Card · elevated`, `RichText` (sizes set by the block), `LinkButton`                                                           | `src/modules/site/ui/ContentBlock.tsx` (#457; props from `toContentBlockProps` in `site/data/mappers.ts`)                                     | B8–B11     |
| `site`      | `CallToActionBlock` | one look                                        | `CallToActionBlockProps`: `body`, `links` (`ResolvedLink[]`)                                                                            | `Section · brand`, `RichText` (dark scope), `Button · inverse`                                                                                             | `src/modules/site/ui/CallToActionBlock.tsx` (#457; props from `toCallToActionBlockProps`)                                                     | B13        |
| `site`      | `ArchiveBlock`      | one look                                        | `ArchiveBlockProps`: `id`, `intro`; the posts as children                                                                               | `Section · surface`, the `news` `PostGrid` passed in by `app/`                                                                                             | `src/modules/site/ui/ArchiveBlock.tsx` (#457; posts from `findArchivePosts` in `news` with the block's `postQuery`, passed in by `app/`)      | B16        |
| `news`      | `PostCard`          | `variant`: `default`, `compact`                 | `post` (`PostSummary`: title, href, date, categories, summary, image)                                                                   | `Card · elevated`, `Media`, `Badge`, `DateTime`                                                                                                            | `PostCard` and `SidebarPosts` in `src/modules/news/ui/`                                                                                       | C1, C2, C8 |
| `news`      | `TopIssuesBlock`    | one look                                        | `TopIssuesBlockProps`: `heading`, `reviewedAt`, `items` (`{ title, summary, link: { href, external } }[]`, at least one)                | `Section · sm`, `Text · overline`, `Text · section`, `Text · small`, `DateTime`, `Link · inline` (44 px tall)                                              | `src/modules/news/ui/TopIssuesBlock.tsx` (#484; props from `toTopIssues`, which maps with `toTopIssuesBlockProps`, called by `app/`)          | B19        |
| `events`    | `EventCard`         | `variant`: `featured`, `compact`, `inline`      | `event` (`EventSummary`, with `cancelled` and `officialBody`)                                                                           | `Card · elevated`, `Media`, `DateBadge`, `MetaList`, `Badge`, `Badge · status` (`CancelledBadge`, #122), `Badge · official` (`OfficialMeetingBadge`, #122) | `EventCard` and `SidebarEvents` in `src/modules/events/ui/`                                                                                   | C5–C7      |
| `events`    | `DateBadge`         | `variant`: `floating`, `plain`, `tinted`        | `date`                                                                                                                                  | —                                                                                                                                                          | `DateBadge` in `EventCard` and a second copy in `SidebarEvents`                                                                               | C9–C11     |
| `events`    | `EventsThisWeek`    | one look                                        | `EventsThisWeekProps`: `heading`, `rows` (`{ title, events, seeAll }[]`, only rows with events), `allEventsHref`                        | `Section · sm`, `Text · overline`, `Text · section`, `Text · subsection`, `CardGrid`, `EventCard · compact`, `Link · action`, `EmptyState`                 | `src/modules/events/ui/EventsThisWeek.tsx` (#122; props from `findEventsThisWeek`, which maps with `toEventsThisWeekProps`, called by `app/`) | B18        |
| `directory` | `ResourceCard`      | one look                                        | `resource` (`ResourceSummary`)                                                                                                          | `Card · elevated`, `Link · action`                                                                                                                         | `src/modules/directory/ui/ResourceCard.tsx`                                                                                                   | C13        |
| `directory` | `FaqList`           | one look                                        | `items` (`{ question, answer }[]`, answers as `RichTextValue`)                                                                          | `Card · outline`, `RichText · compact`, native `<details>`                                                                                                 | `src/modules/directory/ui/FaqList.tsx`                                                                                                        | N16        |
| `contact`   | `FormBlock`         | one look                                        | `form` (each field mapped to a `Field` control), `intro`                                                                                | `Form`, `Field`, `Card · outline`, `Alert`                                                                                                                 | `src/modules/contact/ui/FormBlock.client.tsx`                                                                                                 | B17        |
| `platform`  | `TurnstileWidget`   | one look                                        | `onToken`, `onLoadError`, `onWidgetError`, `resetSignal`                                                                                | —                                                                                                                                                          | `src/platform/turnstile/TurnstileWidget.client.tsx`                                                                                           | F18        |

Compositions with no element of their own: `PostsFeed` and `EventsFeed` (a `CardGrid` of cards plus
`LoadMore`; `EventsFeed` keeps a category filter, #122), `EventsOverview` and `EventListPage` (the
events pages' bodies), `EventFilters` (`Button` links and a status line, #122), the search form in `news` (`Field · search` plus the URL), `AccountMenu` in
`accounts` (`Link · nav` and `Button · ghost`; "Dashboard" for staff in the mobile menu, #378), `SignInForm` and `ChangePasswordForm` (`Form`), and
`VersionCheck` (`Toast`). Variants with no element of their own (`Card · elevated`,
`Card · outline`, `CardGrid` columns `2` and `4`, `Section · brand`, `Button` size `sm`) are used inside the area components.

## Not needed yet

The set holds only what an element needs. The epic's first guess listed about 20 components; the
inventory keeps most, and finds no element for these components and variants:

| Component or variant             | Why not now                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `RadioGroup`                     | no public form has radio buttons; Payload's `radio` fields stay in the admin      |
| `Switch`                         | no on/off control on the site (the theme selector exists in code but isn't shown) |
| `Tabs`                           | no tabbed content                                                                 |
| `Table`                          | no tables, in content or in screens                                               |
| `Pagination`                     | lists use "Load more" with a no-JavaScript fallback page; `LoadMore` covers it    |
| `Field.Input` types `tel`, `url` | no public form asks for a phone number or a web address                           |
| `Text · body`                    | body copy comes through `RichText`; no element uses a plain body paragraph        |
| `Alert` sizes                    | every alert today is the same size                                                |
| `Dialog · center`                | the only dialog is the mobile menu, a sheet                                       |

Added by the inventory, with no counterpart in the epic: `CardGrid`, `DateTime`, `MetaList`,
`Text`, `PageHeader`, `EmptyState`, `Section`, `DetailLayout`, and variants on `RichText`.
Each one replaces markup copied between files ([evidence](evidence.md#duplication)). `Accordion`
from the epic's list is `FaqList` until a second screen needs one.

## Coverage

Every element in the [inventory](inventory.md) maps to exactly one component and variant, in the
last column of its element table ("Target component · variant"). The coverage table, with the
counts, is generated from those tables in
[`docs/reference/ui-coverage.md`](../reference/ui-coverage.md) and checked on every pull request
(`Knowledge sync`, decision [0019](../architecture/decisions/0019-knowledge-layer.md)), so no
element is missing and none maps twice. To change a mapping, edit the element table, then run
`npm run docs:generate`.
