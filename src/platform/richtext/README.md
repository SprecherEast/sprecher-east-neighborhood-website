# Rich text and the editorial blocks

How an article's text is drawn, the blocks an editor can put inside it (banner, code, media and
the editorial blocks: timeline, steps, key facts, outcome fork, diagram key, figure, chart, fact tabs),
the limits those share, and how agents write two of them as Markdown tags. [News](../../modules/news/README.md) posts and [events](../../modules/events/README.md) use it;
page-builder blocks are in the [site note](../../modules/site/README.md). Props and where each
renderer is used: [rich-text components](../../../docs/reference/components/rich-text.md); the
rich-text fields of each collection: [content types](../../../docs/reference/content-types/README.md).

## Links between fields and values

- Limits of key facts, the timeline and fact tabs are written once (`editorial/editorialLimits.ts`); the block's fields, the Markdown tag's checks and the tests read them. A chart's limits are `CHART_LIMITS` in `src/platform/lib/chart/spec.ts`.
- Block slugs of key facts, fact tabs and outcome fork are written once (`editorial/blockTypes.ts`); their configs, the Markdown tags and the article-width rule match on them.
- Stored block to plain props: each `editorial/<block>.ts` maps the stored fields to what the renderer draws and drops items without a heading, title or value (decision 0013). `editorial/chart.ts` maps both ways between the stored rows (numbers, a hatching checkbox) and `ChartSpec`.
- `<Chart … />` and `<FactTabs … />` are written and read with one escaping (`editorial/editorialTag.ts`, `chartMarkdown.ts`, `factTabsMarkdown.ts`); the [agents](../../modules/agents/README.md)' suggestions use them.
- Heading text to anchor id (`headingAnchors.ts`): the renderer's heading ids and the "On this page" menu (`articleToc.tsx`) both read it, so they match.
- A document's first heading becomes a hero title (`splitHeadingFromBody.ts`, used by `src/modules/site/ui/PageHero.tsx`).
- A chart block has a Colors choice: the usual colors or orange and gray (`palette`, `editorial/chartBaseFields.ts`, #856).
- A chart can be a breakdown (kind `breakdown`): a square value in dollars (or Hide the squares, for ranked bars only, #943) and up to seven areas, each with optional pieces; a piece marked Shown sits under its area, the others go in the smaller-pieces list (`editorial/chartBreakdownFields.ts`, #866).
- A chart part's key comes from its label (`editorial/chartKeys.ts`), so one part links across two groups' legends.

## Behaviors and events

- Text keeps the reading width. An article holding key facts, fact tabs or an outcome fork fills the column instead (`articleColumn.ts`, #774); post and event pages both call it.
- The "On this page" menu appears from three sections (`articleToc.tsx`, `src/platform/ui/onThisPage.ts`, #574). Only h2 and h3 count, and headings inside blocks get no anchor (`headingAnchors.ts`). A repeated heading gets `-2`, `-3`.
- A link to a page or post resolves to its site address; one with nowhere to go (a deleted document) shows as plain text (`RichText.tsx`, #215).
- A chart that fails its rules is left out of the page and logged, not allowed to break the article (`richTextBlocks.tsx`). The editor refuses it on save.
- A banner can be closed by the visitor and hidden after its end time; pages refresh every 10 minutes (`BannerBlock.tsx`).
- The media block has two placements: `section` (page builder, brings its own container) and `inline` (inside text, uses the shared figure gap) (`MediaBlock.tsx`, #541).
- Rich text is `flow-root`, so a floated figure stays inside the article's text and what follows never wraps around it (`RichText.tsx`, #816). With `besideFloat` (post and event pages give it when the article has a picture, #1023) it is not a box of its own, so its lines flow beside the article's floated picture, and a clearing end keeps what follows below both the picture and its own figures. A post that opens with key facts, fact tabs or an outcome fork (and the heading that introduces them) is split there (`splitLeadingWideBlocks`, `articleColumn.ts`): the opening is drawn first, then the picture, then the rest of the text with `anchorSource` set to the whole article so heading ids still match the menu, so no blank block is left beside a card row. A card row that comes after some text still starts below a picture that is taller than that text.
- The figure block holds an image, a title, a label, a short and a long caption, a width and an optional numbered key; the key marker list is shared with the diagram key (`editorial/diagramKeyBlockConfig.ts`). `editorial/figure.ts` leaves out empty text and passes the rest to the shared `Figure` (`FigureBlock.tsx`, #817).
- A fact tab opens with its heading and, beside it, how sure we are (shown once: the tab button leaves it to screen readers), then its first chart or timeline (the chart's title and takeaway left to screen readers, since the heading is its title), then the short definition, then the other pictures. A tab whose panel starts with a whole tax bill block (#1018) shows that first: a line on what the estimate is based on, a home value box that starts at the City's average home for the year, a switch between tax years, what that home pays each body (the smallest slice carries its percent above it, and the college is named "Madison College (MATC)"), and the bill as one bar whose slices are as wide as their shares (`editorial/BillShare.client.tsx`, `src/platform/lib/billShare.ts`). The City's slice stands a few pixels above the others and joins the panel under it, which starts with the City's tax as one bar for the year shown (the tab's stacked chart, one column; the proposed increase stays hatched; `editorial/cityBar.ts`), then the tab's short text, then the tab's breakdown chart, then the other pictures (#1020). The bar and the breakdown are drawn again in the browser for every home value and year, so each amount is the City's slice of the bill above it, in whole dollars, the lines adding up exactly to it, with the split unchanged; a chart whose columns are not the tax years draws no bar; with no valid value they show the average home. A panel holds one to three pictures. The tab's source link becomes the link on the first mention of its text in the definition, and a "Source:" line shows only when the definition never says it. Its charts show no "Show the numbers" box and keep the table for screen readers (`editorial/FactTabs.tsx`, `editorial/definitionWithSource.ts`, #980).
- A fact tab button shows its icon on its own line with a short label under it, then the figure, all left-aligned; on a phone only the certainty is left to screen readers (`editorial/FactCard.tsx`, #856).
- Plain text for structured data (`toPlainText.ts`): blocks are separated by a blank line, then trimmed.

## Shared pieces it uses

- Renderers are passed in by the caller, so `RichText.tsx` imports no block and a block can hold rich text without an import cycle (#135). Post and event pages pass `richTextBlocks.tsx`.
- Posts offer banner, code, media and all editorial blocks; events offer the same without code (`blockConfigs.ts`: `RICH_TEXT_BLOCKS`, `EVENT_RICH_TEXT_BLOCKS`). The code block is kept and available to posts; no repository content uses it.
- The composition roots are `src/modules/news/cms/posts.ts` and `src/modules/events/cms/events.ts`, which pass the block lists to the editor.
- Chart drawing is `src/platform/ui/chart/`; the "On this page" menu is `src/platform/ui/OnThisPage.client.tsx` (both in the [UI kit note](../ui/README.md)).
- Also used by [directory](../../modules/directory/README.md) (FAQ answers and their `FAQPage` text) and by the [site note](../../modules/site/README.md)'s hero and content blocks; rich-text colours come from [theme](../theme/README.md) tokens.

## Rules and the tests that protect them

- A field of only spaces counts as empty (`editorial/filledText.ts`).
- List blocks count rows the way Admin sends them: a number during form building is the count, but on a real save a number is no rows (`editorial/rowCount.ts`, #676; `src/payload.config.rowCounts.test.ts`).
- A chart is validated as a whole and each reason shows under its field (`editorial/chartValidate.ts`, `chartValidate.test.ts`, `src/payload.config.chartBlock.test.ts`).
- A timeline has at most one "Next up" milestone, and status is never shown by colour alone: dot shape, connector and a word (`editorial/timelineBlockConfig.ts`, `timelineStatus.ts`, `timelineBlockConfig.test.ts`).
- A tag that breaks the block's rules is refused with the reasons, and text with quotes, braces or backslashes reads back unchanged (`chartMarkdown.test.ts`, `factTabsMarkdown.test.ts`, `src/payload.config.factTabsMarkdown.test.ts`).
- Mappers: `editorial/*.test.ts(x)`, `factTabs*.test.ts`. Article width: `articleColumn.test.ts`. Menu and ids: `articleToc.test.tsx`, `headingAnchors.test.ts`. Title split: `splitHeadingFromBody.test.ts`. Block lists and renderers: `RichText.test.tsx`, `richTextBlocks.test.tsx`, `src/payload.config.test.ts`.

## Boundaries

- May import `src/platform/ui`, `src/platform/lib`, `src/platform/payload` and the generated `@/payload-types`. Modules use it only where they compose it: the CMS configs and pages named above.
- Never put a block's size limit as a literal in its config: add it to `editorial/editorialLimits.ts`.

## Decisions

- [0013](../../../docs/architecture/decisions/0013-cms-content-through-mappers.md) (plain props from mappers), epic #506 (explainer blocks), #640 and #664 (Markdown tags).

## Known gaps

- #676: steps, outcome fork and diagram key accept a number in place of their list.
- Limits of steps, outcome fork and diagram key are literals in their configs, not in `editorial/editorialLimits.ts` (#843).
