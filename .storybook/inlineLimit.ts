/**
 * Vite's `build.assetsInlineLimit` as a function: a font file is never inlined as a data URL, however
 * small, and any other asset keeps Vite's own limit (`undefined`). A showcase must carry each of the site's
 * faces as a file, which `ops/developer-site-check.sh` checks.
 */
export const neverInlineFonts = (file: string): boolean | undefined =>
  /\.woff2$/i.test(file) ? false : undefined
