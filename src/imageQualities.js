// The image qualities the site asks next/image for. next.config.js allows exactly these (Next 16
// refuses a quality that isn't listed, and defaults to 75), and the UI kit uses the names, so a
// quality is defined here once.
export const IMAGE_QUALITIES = {
  /** Photos in content: sharp at full width */
  full: 100,
  /** A page backdrop (PageBackdrop): faded and grayed, so lighter files lose nothing visible */
  backdrop: 50,
}
