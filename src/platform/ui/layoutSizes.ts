/**
 * The classes for the sizes the whole site shares. Each reads a variable from globals.css, so a
 * size is defined once and changed there (#616).
 */

/** How wide article text and the blocks around it run: a comfortable reading line */
export const READING_WIDTH = 'max-w-[var(--reading-width)]'

/** The same, from the `lg` breakpoint up, where a block's container may be wider than the text */
export const READING_WIDTH_LG = 'lg:max-w-[var(--reading-width)]'

/**
 * Reading-width text that starts at the column's left edge instead of being centred in it. Posts and
 * events put their text beside a left rail (#677), so it must share the left edge the breadcrumb
 * and the rail have, not float in the middle of a column wider than the text.
 */
export const READING_COLUMN = `mx-0 ${READING_WIDTH}`

/**
 * The grid of a post's or an event's page from `lg`: the rail (page menu and related content) on
 * the left, the article taking the rest (#677). The rail's width is a variable in globals.css. The
 * page's title band uses it too (#1013), so its title and facts start where the article does.
 */
export const DETAIL_GRID = 'lg:grid lg:grid-cols-[var(--detail-rail-width)_minmax(0,1fr)] lg:gap-8'

/** The space above and below a list page's content, which clears the sticky site header */
export const PAGE_SHELL = 'py-24'

/** The least height of a short page or empty state, so it sits in the middle of the screen */
export const PAGE_MIN_HEIGHT = 'min-h-[var(--page-min-height)]'

/**
 * The home hero is laid out from its photo's horizon (#1304): its geometry (`hero-geometry` in
 * theme/tailwind.css) turns the photo's ratio and focal point into `--hero-photo-h` and
 * `--hero-horizon`, and the spaces and the fade are variables in globals.css.
 */

/** The photo's box: as tall as the photo at full width, and never under `--hero-photo-min` */
export const HERO_PHOTO_HEIGHT = 'h-[var(--hero-photo-h)]'

/** The sky above the horizon, from under the site header: the title sits at its bottom edge */
export const HERO_SKY_HEIGHT = 'min-h-[max(0px,calc(var(--hero-horizon)_-_var(--header-height)))]'

/** The title's distance above the horizon, and the note's and buttons' distance below it */
export const HERO_SKY_GAP = 'pb-[var(--hero-sky-gap)]'
export const HERO_HORIZON_GAP = 'mt-[var(--hero-horizon-gap)]'

/** The space under the note and the buttons, then the next section, which starts a little lower */
export const HERO_BOTTOM_SPACE = 'pb-[var(--hero-bottom-space)]'
export const HERO_BELOW_GAP = 'mb-[var(--hero-below-gap)]'

/** The photo runs on under the next section by the fade's overlap, and the fade is this long */
export const HERO_PHOTO_LAYER_BOTTOM = 'bottom-[calc(var(--hero-fade-overlap)*-1)]'
export const HERO_FADE_LENGTH = 'h-[var(--hero-fade-length)]'

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
 * A legend sits under the image block above it (#636, #658) with a small gap, `--legend-gap`
 * (1rem), instead of the full `--figure-gap`. It only takes back blank margin, so it never covers
 * the image or its caption.
 */
export const LEGEND_GAP = '-mt-[calc(var(--figure-gap)_-_var(--legend-gap))]'

/**
 * How wide a chart's drawing runs (#681, #1206). Stacked (a phone, a narrow column) it fills the
 * width up to 28rem, so its labels stay large; from the chart's `2xl` container it is a thumbnail,
 * 20rem: the drawing's own 320-unit width at 1:1, with the text beside it. In the enlarged dialog
 * it fills a 40rem body. The numbers are variables in globals.css; no adapter sets a width.
 */
export const CHART_SMALL_WIDTH =
  'max-w-[var(--chart-stack-width)] @2xl/chart:max-w-[var(--chart-small-width)]'
export const CHART_LARGE_WIDTH =
  'max-w-[var(--chart-large-width)] [&_[data-chart-drawing]]:max-w-full'

/**
 * The enlarged dialog of a picture with a key (#815): the picture takes two thirds from `lg` and the
 * key one third beside it; below `lg` the key sits under the picture.
 */
export const ZOOM_SPLIT = 'grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]'

/**
 * Rows of a grid handed on to what a box holds (CSS subgrid, #678). Fact cards use them, so in a
 * row of them the same part of every card (what it's about, the value, the explanation, the foot)
 * sits on one line, whatever wraps or is missing in one card.
 * A card spans four rows; the facts inside it span the first three, and the foot is the fourth.
 */
export const SUBGRID_FOUR_ROWS = 'row-span-4 grid grid-rows-subgrid'
export const SUBGRID_THREE_ROWS = 'row-span-3 grid grid-rows-subgrid'

/**
 * A shared row's gap would sit inside every card, so a list of cards that share rows has no row
 * gap. Each card keeps its distance from the next one below with a bottom margin, and the list
 * takes the last one back with the same negative margin. The pair must equal the column gap, so
 * it lives here, for a `CardGrid` with `gap="sm"` (`gap-4`).
 */
export const SHARED_ROWS_SPACE_4 = { item: 'mb-4', list: '-mb-4 gap-y-0' }
