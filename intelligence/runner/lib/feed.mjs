import { XMLParser } from 'fast-xml-parser'

import { collapse, toSourceText } from './text.mjs'

// RSS 2.0 and Atom, shared by the sources whose format is a feed (parsers.mjs, incidents.mjs).

const xml = new XMLParser({ ignoreAttributes: false, processEntities: true, trimValues: true })
const asArray = (value) => (Array.isArray(value) ? value : value === undefined ? [] : [value])
const textOf = (value) =>
  typeof value === 'object' && value !== null ? (value['#text'] ?? '') : (value ?? '')

/** RSS 2.0 or Atom news: dedupe on guid or id; a news item has no start. */
export function parseFeed(body) {
  const doc = xml.parse(body)
  const rssItems = asArray(doc?.rss?.channel?.item)
  const atomItems = asArray(doc?.feed?.entry)
  const fromRss = rssItems.map((item) => ({
    ownId: collapse(textOf(item.guid)) || collapse(textOf(item.link)),
    url: collapse(textOf(item.link)) || null,
    title: collapse(toSourceText(textOf(item.title))) || 'News',
    text: textOf(item['content:encoded']) || textOf(item.description),
    modified: textOf(item.pubDate) || null,
  }))
  const fromAtom = atomItems.map((entry) => {
    const link = asArray(entry.link).find((l) => !l['@_rel'] || l['@_rel'] === 'alternate')
    return {
      ownId: collapse(textOf(entry.id)),
      url: link?.['@_href'] ?? null,
      title: collapse(toSourceText(textOf(entry.title))) || 'News',
      text: textOf(entry.content) || textOf(entry.summary),
      modified: textOf(entry.updated) || null,
    }
  })
  return [...fromRss, ...fromAtom]
    .filter((item) => item.ownId)
    .map((item) => ({
      ownId: item.ownId,
      kind: 'news',
      title: item.title,
      sourceText: toSourceText(item.text),
      startsAt: null,
      endsAt: null,
      allDay: null,
      locationText: null,
      sourceStatus: 'unknown',
      url: item.url,
      modified: item.modified,
    }))
}
