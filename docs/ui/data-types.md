# Data types and the components that handle them

Part of the [UI inventory](inventory.md) (#170). For each kind of data: the Payload field type it's
stored in, where the public site shows it today, and the component that shows or edits it in the
[component set](component-set.md). Fields are listed in full in the
[data model](../architecture/data-model.md).

Components get plain typed data, never Payload documents: a module's `data/` maps documents to its
own types (`EventSummary`, `PostSummary`), and rich text and images travel as `RichTextValue` and
`ImageRef` from `platform/lib/` ([architecture](../architecture/README.md#layers-the-core-stays-still-the-edges-can-change)).

## Public site

| Data type                | Payload field type                                     | Shown today (examples)                                                                     | Show with                                                                                                              | Edit with (public forms)               |
| ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Short text               | `text`                                                 | titles, names, place names, labels                                                         | `Text`, card titles, `MetaList`                                                                                        | `Field · text`                         |
| Long text                | `textarea`                                             | card summaries, event summary, resource description                                        | `Text · small` (clamped), `Text · lead`                                                                                | `Field · textarea`                     |
| Email address            | `email`; auth email on `users`                         | account profile (`users.email`); `team-members.email` is never public                      | `MetaList · stacked`                                                                                                   | `Field · email`                        |
| Password                 | auth password on `users`                               | never shown                                                                                | —                                                                                                                      | `Field · password`                     |
| Number                   | `number`                                               | none on the public site (`order`, `limit` only sort and size lists)                        | `Text`                                                                                                                 | `Field · number`                       |
| Calendar day             | `date`, day only (`events.date`)                       | date badges, short and long event dates                                                    | `DateBadge`, `DateTime` (formats in UTC so the day never shifts)                                                       | none yet (see below)                   |
| Date and time            | `date`, day and time (`publishedAt`)                   | post dates                                                                                 | `DateTime` (formats in the site timezone)                                                                              | none yet                               |
| Time of day as text      | `text` (`events.timeStart`, `timeEnd`)                 | "6:00 PM – 7:30 PM Central Time" in cards and heroes                                       | `MetaList` item; storing times as text is a CMS decision                                                               | —                                      |
| URL                      | `text` (`registrationUrl`, `mapsUrl`, `resources.url`) | register button, map link, "Visit Website"                                                 | `Button` or `Link` with `external`                                                                                     | none today (`url` type not needed yet) |
| Phone number             | `text` (`resources.phone`)                             | resource phone link                                                                        | `Link · action` with `tel:`                                                                                            | none today (`tel` type not needed yet) |
| One option from a list   | `select`                                               | FAQ and resource category, event format, banner style, column size, link appearance        | `Badge · category`, `Text · section` (grouping), `MetaList` value, or the variant of `Alert`, `ContentBlock`, `Button` | `Field · select`                       |
| One option, few choices  | `radio` (`link.type`)                                  | admin only; decides how a link's URL is built                                              | resolved before rendering                                                                                              | `RadioGroup` (not needed yet)          |
| Yes or no                | `checkbox`                                             | `newTab`, `enableLink`, `enableIntro`; `events.featured` is unused                         | a prop (`external`, show or hide a part)                                                                               | `Field · checkbox`                     |
| Link to another document | `relationship`                                         | related and recent posts, selected posts, post and event categories, link targets, authors | `PostCard`, `EventCard`, `Badge · category`, `Link`, `MetaList`                                                        | —                                      |
| Image or file            | `upload` (→ `media`)                                   | hero photos, framed images; card images and thumbnails once #196 is fixed                  | `Media` (`alt` from `media.alt`; caption is rich text)                                                                 | —                                      |
| Formatted text           | `richText` (Lexical)                                   | post and event bodies, FAQ answers, hero text, block text, captions, confirmation message  | `RichText` (`prose`, `compact`, `inverse`)                                                                             | —                                      |
| Code                     | `code` (inside the code block)                         | code block in post bodies                                                                  | `CodeBlock`                                                                                                            | —                                      |
| List of rows             | `array`                                                | nav items, hero and CTA links, post authors, search categories                             | the row's component (`Link · nav`, `Button`, `MetaList`, `Badge`)                                                      | —                                      |
| Page sections            | `blocks`                                               | page layout, rich-text blocks, form-builder fields                                         | the block's component (table below)                                                                                    | —                                      |
| Group of fields          | `group` (`link`, `meta`, `hero`)                       | links, card summary and image, heroes                                                      | mapped to props: `resolveLink()` → `Link`/`Button`; `meta` → card                                                      | —                                      |
| Slug                     | `text` from `slugField()`                              | every URL                                                                                  | used to build `href`; not shown                                                                                        | —                                      |

## Blocks and the component for each

| Block (`blockType`) | Where it can go        | Component · variant                                                                                |
| ------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| `content`           | page layout            | `ContentBlock` · `single`, `columns`, `cards` or `stats`                                           |
| `cta`               | page layout, rich text | `CallToActionBlock` · default                                                                      |
| `mediaBlock`        | page layout, rich text | `Media · framed`                                                                                   |
| `archive`           | page layout            | `ArchiveBlock` · default                                                                           |
| `formBlock`         | page layout            | `FormBlock` · default                                                                              |
| `eventsThisWeek`    | page layout            | `EventsThisWeek` · default                                                                         |
| `topIssues`         | page layout            | `TopIssuesBlock` · default                                                                         |
| `banner`            | rich text              | `Alert` · `{style}`, `Dismissible` when `dismissible` is on (`showUntil` hides it after that time) |
| `code`              | rich text              | `CodeBlock` · default                                                                              |

## Form-builder fields

The form builder (`@payloadcms/plugin-form-builder`) stores a form's fields as blocks. Each maps to
one field component; payment is turned off.

| Form-builder field | Data           | Component · variant                  |
| ------------------ | -------------- | ------------------------------------ |
| `text`             | short text     | `Field · text`                       |
| `email`            | email address  | `Field · email`                      |
| `number`           | number         | `Field · number`                     |
| `textarea`         | long text      | `Field · textarea`                   |
| `select`           | one option     | `Field · select`                     |
| `state`            | US state       | `Field · select` (fixed option list) |
| `country`          | country        | `Field · select` (fixed option list) |
| `checkbox`         | yes or no      | `Field · checkbox`                   |
| `message`          | formatted text | `RichText · compact` (not an input)  |

`width` (a percentage) becomes `Field` width `full` or `half` inside `Form`'s grid.

## The Payload admin

The admin (`/admin`) keeps Payload's own fields, styled with the site's tokens, and isn't rebuilt
with these components. Its field types still matter, so the public components and the CMS agree:

| Payload field type                     | Used here                                       | Public component when one is needed                    |
| -------------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| `text`, `textarea`, `email`, `number`  | everywhere                                      | `Field` (above)                                        |
| `date`                                 | events (day only), `publishedAt` (day and time) | `Field.Input type="date"` when a public form needs one |
| `select`, `radio`, `checkbox`          | categories, roles, link type, flags             | `Field · select`, `RadioGroup`, `Field · checkbox`     |
| `relationship`, `upload`               | links between documents, media                  | no public editor planned                               |
| `richText`, `blocks`, `array`, `group` | content, layouts, lists                         | no public editor planned                               |
| `code`                                 | code block                                      | no public editor planned                               |
| `tabs`, `row`, `collapsible`, `ui`     | admin layout only                               | none: they hold no data                                |
| `json`, `point`, `join`                | not used                                        | none                                                   |

## Data with no public UI today

- `team-members` (board members and AI agents): nothing on the site renders them.
- `events.featured`, `users.role`: stored, never shown.
- `meta.image` on pages, posts and events: stored, but reads never return it, because the SEO
  plugin's own `meta` group (no image) replaces the SEO tab's (#196). Cards and sidebar
  thumbnails show placeholders, and every share image is the site default
  ([evidence](evidence.md#bugs-found-while-taking-the-inventory), bug 6).
