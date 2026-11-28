---
name: 'Rich text'
type: platform-area
summary: 'article text, blocks, Markdown tags.'
aliases: ['editorial blocks', 'article text']
relationships: []
---

# Rich text and the editorial blocks

How an article's text is drawn, the blocks an editor can put inside it (banner, code, media and the editorial blocks: timeline, steps, key facts, outcome fork, diagram key, figure, chart, fact tabs, section tabs), the limits those share, and how agents write three of them as Markdown tags. In the CMS: the Lexical editor of posts and events (posts offer every block, events the same without code); not in the CMS: the renderers and the Markdown tags. [News](../../modules/news/README.md) and [events](../../modules/events/README.md) use it; [directory](../../modules/directory/README.md) draws FAQ answers with it; page-builder blocks are in the [site note](../../modules/site/README.md). The tax-bill panel inside a fact tab has its own note: [Whole tax bill](editorial/README.md). Props: [rich-text components](../../../docs/reference/components/rich-text.md); fields: [content types](../../../docs/reference/content-types/README.md).

## How the pieces link

- **Written once:** limits of key facts, timeline, fact tabs, section tabs and the tax-bill block (`BILL_SHARE_LIMITS`, see [Whole tax bill](editorial/README.md)) are in `editorial/editorialLimits.ts` (a chart's are `CHART_LIMITS` in `src/platform/lib/chart/spec.ts`), and block slugs in `editorial/blockTypes.ts`; the configs, the Markdown tags and the article-width rule all read them.
- **Stored block to plain props:** each `editorial/<block>.ts` maps stored fields to what the renderer draws and drops items without a heading, title or value (decision 0013); `editorial/chart.ts` maps both ways between stored rows and `ChartSpec`.
- **Markdown tags for agents:** `<Chart … />` and `<FactTabs … />` are written and read with one escaping (`editorial/editorialTag.ts`, `chartMarkdown.ts`, `factTabsMarkdown.ts`); `<SectionTabs>` holds one `<Tab label="…">` per tab (`sectionTabsMarkdown.ts`); [agents](../../modules/agents/README.md)' suggestions use them.
- **Headings and anchors:** the heading id and the "On this page" menu both read `headingAnchors.ts`, so they match; a document's first heading becomes a hero title (`splitHeadingFromBody.ts`, used by `src/modules/site/ui/PageHero.tsx`).
- **Renderers are passed in by the caller,** so `RichText.tsx` imports no block and a block can hold rich text without an import cycle (#135); post and event pages pass `richTextBlocks.tsx`, and their CMS configs (`src/modules/news/cms/posts.ts`, `src/modules/events/cms/events.ts`) pass the block lists (`blockConfigs.ts`).
- **Libraries doing real work:** `@payloadcms/richtext-lexical` (editor and tree), `prism-react-renderer` (code blocks); chart drawing and the menu are in the [UI kit](../ui/README.md); colours are [theme](../theme/README.md) tokens.

## Behaviors and events

- **Text keeps the reading width;** an article holding key facts, fact tabs, section tabs or an outcome fork fills the column (`articleColumn.ts`, #774). With a picture the text flows beside it and a post that opens with such a block draws that first, then the picture, then the text (`RichText.tsx`, `splitLeadingWideBlocks`, #816, #1023).
- **The "On this page" menu appears from three sections;** only h2 and h3 count, headings inside blocks get no anchor (except those in a section tab's content), and a repeated heading gets `-2`, `-3` (`articleToc.tsx`, `src/platform/ui/onThisPage.ts`, #574).
- **A link to a page or post resolves to its site address;** one with nowhere to go shows as plain text (`RichText.tsx`, #215).
- **A banner can be closed by the visitor** and hidden after its end time (`BannerBlock.tsx`); the media block has `section` and `inline` placements (`MediaBlock.tsx`, #541).
- **Section tabs** (#1333) split an article into two to four tabs, each a label (at most `SECTION_TABS_LIMITS.label`) and its own rich-text field, drawn on the server so with scripting off the tabs show one after another (`editorial/SectionTabs.tsx`, `SectionTabsBlock.tsx`). **Fact tabs** show a heading, the figure and how sure we are, then charts, timeline, definition and pictures (`editorial/FactTabs.tsx`, `FactCard.tsx`).
- **Plain text for structured data** blocks separated by a blank line (`toPlainText.ts`).

## Shared pieces it uses

- The kit (`Tabs`, `Figure`, `Disclosure`, `Chart`), `src/platform/lib` (chart spec, `billShare`) and `src/platform/payload` (editor config); the generated `@/payload-types`.

## Rules and the tests that protect them

- **A chart that fails its rules is left out of the page and logged,** never breaking the article; the editor refuses it on save and each reason shows under its field (`richTextBlocks.tsx`, `editorial/chartValidate.ts`; `editorial/chartValidate.test.ts`, `src/payload.config.chartBlock.test.ts`).
- **A tag that breaks its block's rules is refused with the reasons,** and text with quotes, braces or backslashes reads back unchanged; a section tabs block needs two to four tabs, no empty tab and no tabs inside a tab, and cannot be published otherwise (`chartMarkdown.test.ts`, `factTabsMarkdown.test.ts`, `src/payload.config.factTabsMarkdown.test.ts`, `src/payload.config.sectionTabsMarkdown.test.ts`, `src/payload.config.sectionTabs.test.ts`).
- **A fact tab's label stops at one short limit** so it fits its button down to 320 px; labels already stored are not changed (`FACT_TABS_LIMITS.label`, #1112; `src/payload.config.factTabs.test.ts`).
- **A timeline has at most one "Next up" milestone,** and status is never shown by colour alone (`editorial/timelineBlockConfig.ts`, `timelineStatus.ts`; `timelineBlockConfig.test.ts`).
- **List blocks count rows the way Admin sends them:** a number during form building is the count, on a real save it is no rows; a field of only spaces is empty (`editorial/rowCount.ts`, `editorial/filledText.ts`, #676; `src/payload.config.rowCounts.test.ts`).
- **Every fact tab and heading has a link of its own** (`editorial/tabAnchors.ts`, #1097); article width: `articleColumn.test.ts`; menu and ids: `articleToc.test.tsx`, `headingAnchors.test.ts`; title split: `splitHeadingFromBody.test.ts`; block lists and renderers: `RichText.test.tsx`, `richTextBlocks.test.tsx`, `src/payload.config.test.ts`.

## Boundaries

- May import `src/platform/ui`, `src/platform/lib`, `src/platform/payload` and `@/payload-types`; modules use it only where they compose it. A block's size limit is never a literal in its config: add it to `editorial/editorialLimits.ts`.

## Decisions

[0013](../../../docs/architecture/decisions/0013-cms-content-through-mappers.md) (plain props from mappers), epic #506 (explainer blocks), #640 and #664 (Markdown tags).

## Known gaps

- #676: steps, outcome fork and diagram key accept a number in place of their list.
- Limits of steps, outcome fork and diagram key are literals in their configs, not in `editorial/editorialLimits.ts` (#843).
- The code block is available to posts but no repository content uses it.
