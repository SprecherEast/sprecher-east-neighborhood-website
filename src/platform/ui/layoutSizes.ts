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
