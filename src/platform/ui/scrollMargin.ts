/**
 * The classes that stop a jump to an element (`#id`, `scrollIntoView`) short of the sticky site
 * header. Each reads a variable from globals.css, so the header's height is defined once.
 */

/** A target on a page with only the header to clear, such as a form's success message */
export const HEADER_SCROLL_MARGIN = 'scroll-mt-[var(--header-clearance)]'

/** A heading an "On this page" menu links to: clear of the header and, on phones, the bar too */
export const SECTION_SCROLL_MARGIN = 'scroll-mt-[var(--anchor-offset)]'

/**
 * An open-and-close box brought into view when a reader opens it (#1152): its top stops where a
 * section heading does, and a small gap stays under its end
 */
export const REVEAL_SCROLL_MARGIN = `${SECTION_SCROLL_MARGIN} scroll-mb-4`
