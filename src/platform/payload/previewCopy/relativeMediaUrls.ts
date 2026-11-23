/**
 * A copied picture record keeps the addresses the export's own Payload built, which has no site
 * address there and so wrote `http://localhost:3000/...` (#1420). The image loader refuses those,
 * and a preview has an address of its own, so the import keeps path and query only: the same
 * relative form the site's pages read (`getMediaUrl`). Relative addresses pass through unchanged.
 */

const ABSOLUTE = /^https?:\/\//i

const relative = (value: unknown): unknown => {
  if (typeof value !== 'string' || !ABSOLUTE.test(value)) return value
  const { pathname, search } = new URL(value)
  return `${pathname}${search}`
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A copy of a media record whose `url`, `thumbnailURL` and `sizes.*.url` are relative. */
export function relativeMediaUrls<T extends Record<string, unknown>>(doc: T): T {
  const out: Record<string, unknown> = { ...doc }
  if ('url' in out) out.url = relative(out.url)
  if ('thumbnailURL' in out) out.thumbnailURL = relative(out.thumbnailURL)
  if (isObject(out.sizes)) {
    out.sizes = Object.fromEntries(
      Object.entries(out.sizes).map(([name, size]) => [
        name,
        isObject(size) && 'url' in size ? { ...size, url: relative(size.url) } : size,
      ]),
    )
  }
  return out as T
}
