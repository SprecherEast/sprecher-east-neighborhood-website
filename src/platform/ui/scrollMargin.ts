/**
 * The classes that stop a jump to an element (`#id`, `scrollIntoView`) short of the sticky site
 * header. Each reads a variable from globals.css, so the header's height is defined once.
 */

/** A target on a page with only the header to clear, such as a form's success message */
export const HEADER_SCROLL_MARGIN = 'scroll-mt-[var(--header-clearance)]'

/** A heading an "On this page" menu links to: clear of the header and, on phones, the bar too */
export const SECTION_SCROLL_MARGIN = 'scroll-mt-[var(--anchor-offset)]'

/**
 * The CSS variable an opened box sets on itself: how much room to keep under its end for the header
 * of the box directly under it (#1154). Unset, it counts as none.
 */
export const REVEAL_PEEK_VAR = '--reveal-peek'

/**
 * An open-and-close box brought into view when a reader opens it (#1152): its top stops where a
 * section heading does, and under its end stay a small gap and the room `REVEAL_PEEK_VAR` asks for.
 * The class is written out whole, variable name included, because Tailwind only finds whole class
 * names; `scrollMargin.test.ts` keeps the two in step.
 */
export const REVEAL_SCROLL_MARGIN = `${SECTION_SCROLL_MARGIN} scroll-mb-[calc(--spacing(4)+var(--reveal-peek,0px))]`
