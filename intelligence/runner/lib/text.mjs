import { createHash } from 'node:crypto'

// Text from sources is untrusted (scout.md, "Untrusted content"): markup is removed before any
// model sees it, and nothing in it is ever followed or run.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

/** Plain text from HTML: scripts and styles dropped with their content, tags removed. */
export function stripMarkup(html) {
  if (html === null || html === undefined) return ''
  return (
    String(html)
      .replace(/<(script|style|noscript|iframe)[\s\S]*?<\/\1\s*>/gi, ' ')
      .replace(/<(script|style|noscript|iframe)[^>]*\/?>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
      // Any angle bracket left over (a broken or nested tag) goes too: this text is never markup
      .replace(/[<>]/g, ' ')
      .replace(/&(#\d+|#x[0-9a-f]+|[a-z0-9]+);/gi, (whole, name) => {
        if (name[0] === '#') {
          const code =
            name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
          return Number.isFinite(code) ? String.fromCodePoint(code) : whole
        }
        return ENTITIES[name.toLowerCase()] ?? whole
      })
  )
}

/** Whitespace collapsed to single spaces, trimmed. */
export const collapse = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()

/** A candidate's `sourceText`: markup stripped, collapsed, at most 8,000 characters. */
export const toSourceText = (html) => collapse(stripMarkup(html)).slice(0, 8000)

/**
 * `contentHash` (provenance.schema.json): sha256 of title, sourceText, startsAt, endsAt, allDay,
 * locationText and sourceStatus, each trimmed with whitespace collapsed, text lowercased, null as
 * an empty string, joined by newlines in that order. Retrieval metadata is never hashed.
 */
export function contentHash(candidate) {
  const text = (value) => collapse(value).toLowerCase()
  const plain = (value) => (value === null || value === undefined ? '' : collapse(String(value)))
  const fields = [
    text(candidate.title),
    text(candidate.sourceText),
    plain(candidate.startsAt),
    plain(candidate.endsAt),
    plain(candidate.allDay),
    text(candidate.locationText),
    plain(candidate.sourceStatus),
  ]
  return createHash('sha256').update(fields.join('\n')).digest('hex')
}

/** A title and start reduced for matching the same item across sources (scout.md step 6). */
export const matchKey = (candidate) =>
  `${collapse(candidate.title)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')}|${candidate.startsAt ?? ''}`
