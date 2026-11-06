# Decision records

Short notes on decisions that shape the code, so they aren't argued again without new information.
Each record says what was decided, why, and what it costs. To change a decision, add a new record
that supersedes the old one; don't edit history.

| #                                                            | Decision                                                        | Date       | Status                               |
| ------------------------------------------------------------ | --------------------------------------------------------------- | ---------- | ------------------------------------ |
| [0001](0001-modular-monolith.md)                             | Organize code as a modular monolith by business area            | 2026-10-19 | Accepted                             |
| [0002](0002-no-repository-layer.md)                          | No repository layer over Payload                                | 2026-10-19 | Accepted                             |
| [0003](0003-turnstile-robot-check.md)                        | Cloudflare Turnstile for public forms, failing closed           | 2026-10-19 | Accepted                             |
| [0004](0004-email-through-smtp.md)                           | Email through Mailgun SMTP; never to addresses visitors type    | 2026-10-19 | Accepted                             |
| [0005](0005-paging-with-real-links.md)                       | "Load more" is a real link, with offset paging for now          | 2026-10-19 | Accepted; offset superseded by 0014  |
| [0006](0006-clean-layers-and-pluggable-themes.md)            | Clean layers inside each module, and pluggable themes           | 2026-10-20 | Accepted; point 5 superseded by 0012 |
| [0007](0007-email-confirmation.md)                           | People confirm their email with a link; an account is optional  | 2026-10-21 | Accepted                             |
| [0008](0008-compose-modules-at-the-app-level.md)             | Modules don't import each other; the app composes them          | 2026-10-21 | Accepted                             |
| [0009](0009-email-confirmation-token.md)                     | Confirmation links use our own hashed token, not `auth.verify`  | 2026-10-22 | Accepted                             |
| [0010](0010-contact-data-retention.md)                       | Contact data is deleted on a schedule by Payload's jobs queue   | 2026-10-24 | Accepted                             |
| [0011](0011-scheduled-publishing-runner.md)                  | Scheduled publishing runs in the app; pages refresh in 10 min   | 2026-10-24 | Accepted                             |
| [0012](0012-runtime-themes.md)                               | Themes switch at runtime, on two axes: mode and theme           | 2026-10-25 | Accepted                             |
| [0013](0013-cms-content-through-mappers.md)                  | Blocks and heroes take plain props, mapped from the CMS         | 2026-10-26 | Accepted                             |
| [0014](0014-cursor-paging-for-load-more.md)                  | "Load more" asks for what comes after the last item             | 2026-10-27 | Accepted                             |
| [0015](0015-event-filters-as-pages.md)                       | Each event category filter is a cached page of its own          | 2026-10-27 | Accepted                             |
| [0016](0016-one-service-helper-no-pass-through-use-cases.md) | One service helper; no use case for a plain read                | 2026-10-31 | Accepted                             |
| [0017](0017-one-message-catalog.md)                          | One message catalog in code; durations come from the settings   | 2026-11-01 | Accepted                             |
| [0018](0018-charts-behind-our-own-port.md)                   | Charts behind our own port; HTML for square grids, visx for SVG | 2026-11-04 | Accepted                             |
| [0019](0019-knowledge-layer.md)                              | Short notes and generated reference, kept in sync by CI         | 2026-11-06 | Accepted                             |

Template for a new record: **Context** (the problem and the forces), **Decision**, **Consequences**
(what gets easier, what gets harder), **Links** (issues, PRs, sources).
