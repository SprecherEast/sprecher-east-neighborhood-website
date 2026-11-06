/**
 * The classes for the sizes the whole site shares. Each reads a variable from globals.css, so a
 * size is defined once and changed there (#616).
 */

/** How wide article text and the blocks around it run: a comfortable reading line */
export const READING_WIDTH = 'max-w-[var(--reading-width)]'

/** The same, from the `lg` breakpoint up, where a block's container may be wider than the text */
export const READING_WIDTH_LG = 'lg:max-w-[var(--reading-width)]'

/** A page grid with a centred reading column of that width between two flexible sides */
export const READING_GRID = 'lg:grid-cols-[1fr_var(--reading-width)_1fr]'

/** The space above and below a list page's content, which clears the sticky site header */
export const PAGE_SHELL = 'py-24'

/** The least height of a short page or empty state, so it sits in the middle of the screen */
export const PAGE_MIN_HEIGHT = 'min-h-[var(--page-min-height)]'

/** The least height of a page's hero band */
export const HERO_MIN_HEIGHT = 'min-h-[var(--hero-min-height)]'

/**
 * The least height and width of something you tap: 44 px on a phone (WCAG 2.5.8), a compact 36 px
 * from `lg` up where a pointer is precise (#634). Written here once for links, buttons and menu
 * rows, so the number is never typed again.
 */
export const TOUCH_MIN_HEIGHT = 'min-h-11 lg:min-h-9'
export const TOUCH_MIN_WIDTH = 'min-w-11 lg:min-w-9'

/** The space above and below an image block in an article (#636) */
export const FIGURE_GAP = 'my-[var(--figure-gap)]'

/**
 * A legend hangs from the image above it (#636): it cancels the image block's bottom space and
 * reaches a little further up under the image, so its square top corners are hidden. Its top
 * padding adds the hidden part back, so the content starts below the image's edge.
 */
export const LEGEND_HANG = '-mt-[calc(var(--figure-gap)+var(--legend-overlap))]'
export const LEGEND_TUCK = 'pt-[calc(var(--legend-overlap)+1rem)]'

/**
 * How wide a chart's drawing runs (#681). In the page it is a thumbnail, 20rem: the drawing's own
 * 320-unit width at 1:1, so its labels are the size they were designed at. In the enlarged dialog
 * it fills a 40rem body. Both numbers are variables in globals.css; no adapter sets a width.
 */
export const CHART_SMALL_WIDTH = 'max-w-[var(--chart-small-width)]'
export const CHART_LARGE_WIDTH =
  'max-w-[var(--chart-large-width)] [&_[data-chart-drawing]]:max-w-full'

/**
 * Rows of a grid handed on to what a box holds (CSS subgrid, #678). Fact cards and the tab buttons
 * of Fact tabs use them, so in a row of them the same part of every card (what it's about, the
 * value, the explanation, the foot) sits on one line, whatever wraps or is missing in one card.
 * A card spans four rows; the facts inside it span the first three, and the foot is the fourth.
 * The grid of tab buttons has no parent grid to take rows from, so it declares the four itself.
 */
export const SUBGRID_FOUR_ROWS = 'row-span-4 grid grid-rows-subgrid'
export const SUBGRID_THREE_ROWS = 'row-span-3 grid grid-rows-subgrid'
export const SUBGRID_FOUR_ROWS_EXPLICIT = 'grid-rows-[repeat(4,auto)]'

/**
 * A shared row's gap would sit inside every card, so a list of cards that share rows has no row
 * gap. Each card keeps its distance from the next one below with a bottom margin, and the list
 * takes the last one back with the same negative margin. The pair must equal the column gap, so
 * it lives here, for a `CardGrid` with `gap="sm"` (`gap-4`). The tab buttons are always one row,
 * so they need only the missing row gap (`gap-y-0`).
 */
export const SHARED_ROWS_SPACE_4 = { item: 'mb-4', list: '-mb-4 gap-y-0' }
