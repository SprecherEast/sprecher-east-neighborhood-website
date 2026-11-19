import { describe, expect, it } from 'vitest'

import {
  FORUM_DEFAULT_URL,
  FORUM_URL_PROBLEM,
  toForumUrl,
  trimForumUrl,
  validateForumUrl,
} from './forum'

describe('toForumUrl', () => {
  it.each([
    [FORUM_DEFAULT_URL, 'https://discourse.sprechereast.org/'],
    ['https://discourse.sprechereast.org/', 'https://discourse.sprechereast.org/'],
    ['https://forum.example.org/c/news/5', 'https://forum.example.org/c/news/5'],
    ['HTTPS://FORUM.EXAMPLE.ORG', 'https://forum.example.org/'],
    [`  ${FORUM_DEFAULT_URL}  `, 'https://discourse.sprechereast.org/'],
  ])('links %s to the address the browser reads, %s', (value, href) => {
    expect(toForumUrl(value)).toBe(href)
  })

  it.each([
    null,
    undefined,
    42,
    '',
    '   ',
    'http://forum.example.org',
    'javascript:alert(1)',
    'data:text/html,hi',
    '//forum.example.org',
    '/forum',
    'forum.example.org',
    'https://',
    'https://forum.example.org/a b',
    'https://forum.\texample.org',
    'https://forum.exam\nple.org',
    'mailto:forum@example.org',
    // Written oddly: browsers read these as https addresses, but the link would differ from
    // what an editor sees (#494 review)
    'https:forum.example.org',
    'https:/forum.example.org',
    'https:\\\\evil.example.org',
    // A user name sends the visitor to the host after the @
    'https://discourse.sprechereast.org@evil.example',
    'https://user:pass@forum.example.org',
    // Not a host name
    'https://.',
    'https://-',
    'https://forum',
    'https://for\u200bum.example.org',
  ])('draws no link for %j', (value) => {
    expect(toForumUrl(value)).toBeNull()
  })
})

describe('validateForumUrl', () => {
  it.each([null, undefined, ''])('allows %j, which hides the links', (value) => {
    expect(validateForumUrl(value)).toBe(true)
  })

  it('allows an https address', () => {
    expect(validateForumUrl(FORUM_DEFAULT_URL)).toBe(true)
  })

  it.each(['http://forum.example.org', 'javascript:alert(1)', 'forum.example.org'])(
    'refuses %s with a message editors can act on',
    (value) => {
      expect(validateForumUrl(value)).toBe(FORUM_URL_PROBLEM)
    },
  )
})

describe('trimForumUrl', () => {
  it('stores the address without the spaces typed around it', () => {
    expect(trimForumUrl(`  ${FORUM_DEFAULT_URL}\n`)).toBe(FORUM_DEFAULT_URL)
  })

  it('leaves an empty value alone', () => {
    expect(trimForumUrl(null)).toBeNull()
    expect(trimForumUrl(undefined)).toBeUndefined()
  })
})
