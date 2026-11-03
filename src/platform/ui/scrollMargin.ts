/**
 * The classes that stop a jump to an element (`#id`, `scrollIntoView`) short of the sticky site
 * header. Each reads a variable from globals.css, so the header's height is defined once.
 */

/** A target on a page with only the header to clear, such as a form's success message */
export const HEADER_SCROLL_MARGIN = 'scroll-mt-[var(--header-clearance)]'

/** A heading an "On this page" menu links to: clear of the header and, on phones, the bar too */
export const SECTION_SCROLL_MARGIN = 'scroll-mt-[var(--anchor-offset)]'
