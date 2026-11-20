import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PASSKEY_LABEL,
  PASSKEY_LABEL_MAX_LENGTH,
  isAllowedPasskeyLabel,
  toPasskeyLabel,
} from './passkeys'

describe('toPasskeyLabel', () => {
  it('trims and collapses whitespace', () => {
    expect(toPasskeyLabel('  My   phone \n')).toBe('My phone')
  })

  it('falls back to the default for nothing, blanks and non-text', () => {
    for (const raw of [undefined, null, '', '   ', 42, {}]) {
      expect(toPasskeyLabel(raw)).toBe(DEFAULT_PASSKEY_LABEL)
    }
  })

  it('drops control characters', () => {
    expect(toPasskeyLabel('Phone\u0000\u0007 one')).toBe('Phone one')
  })

  it('keeps letters, numbers, spaces and basic punctuation, in any language', () => {
    for (const label of [
      'My phone',
      'Ada’s laptop',
      'Work (2nd) key',
      'Téléphone',
      'Phone_2, blue',
    ]) {
      expect(toPasskeyLabel(label)).toBe(label)
    }
  })

  it.each([
    ['a web address', 'sprecher-east-help.com to undo this', 'sprecher-east-help com to undo this'],
    ['an email address', 'you@help.example', 'you help example'],
    ['a link', 'https://help.example/undo', 'https help example undo'],
    ['www', 'www help', 'www help'],
    ['markup', '<b>Phone</b> & "co"', 'b Phone b co'],
  ])('neutralises %s, so the email carries no clickable link or address', (_name, raw, label) => {
    const clean = toPasskeyLabel(raw)
    expect(clean).toBe(label)
    expect(clean).not.toMatch(/[./:@<>&"]/)
  })

  it.each([
    ['a digit-full-stop sign', 'sprecher-east-help⒈com', 'sprecher-east-help1 com'],
    ['a fullwidth dot and at sign', 'you＠help．example', 'you help example'],
    ['a modifier-letter colon', 'httpsːᐟᐟhelp', 'https ᐟᐟhelp'],
    ['an invisible joiner mark', 'help\u034Fcom', 'help com'],
    ['an overlay slash', 'a\u0338b', 'a b'],
    ['a pile of marks', 'a\u0301\u0302\u0303\u0304\u0305', 'á\u0302\u0303\u0304'],
  ])('looks past %s', (_name, raw, label) => {
    const clean = toPasskeyLabel(raw)
    expect(clean).toBe(label)
    expect(isAllowedPasskeyLabel(clean)).toBe(true)
  })

  it('reads a fullwidth or composed letter as the plain one', () => {
    expect(toPasskeyLabel('Ａda')).toBe('Ada')
    expect(toPasskeyLabel('Cafe\u0301')).toBe('Café')
  })

  it('falls back to the default when nothing allowed is left', () => {
    expect(toPasskeyLabel('...@@//')).toBe(DEFAULT_PASSKEY_LABEL)
  })

  it('keeps it to the length the list has room for', () => {
    const label = toPasskeyLabel('x'.repeat(500))
    expect(label).toHaveLength(PASSKEY_LABEL_MAX_LENGTH)
  })
})

describe('isAllowedPasskeyLabel: what a neighbor may type', () => {
  it.each([
    '',
    'My phone',
    'Ada’s laptop',
    'Téléphone 2',
    'Кухня',
    'ʻOhana',
    'ケータイ',
    'নমস্কার',
    'मेरा फ़ोन',
    'هاتفي',
    'Cafe\u0301',
  ])('accepts %j', (label) => {
    expect(isAllowedPasskeyLabel(label)).toBe(true)
  })

  it.each([
    'a.b',
    'you@help.example',
    'https://x',
    'www help.com',
    'a/b',
    'a:b',
    '<b>',
    'Phone\u0007',
    'sprecher-east-help⒈com',
    '🄀',
    'you＠help．example',
    'httpsːᐟᐟhelp',
    'help\u034Fcom',
    'a\u0338b',
    'a\u0301\u0302\u0303\u0304\u0305',
    'x'.repeat(PASSKEY_LABEL_MAX_LENGTH + 1),
  ])('refuses %j', (label) => {
    expect(isAllowedPasskeyLabel(label)).toBe(false)
  })
})
