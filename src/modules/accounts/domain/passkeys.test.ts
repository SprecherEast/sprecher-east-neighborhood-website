import { describe, expect, it } from 'vitest'

import {
  CHALLENGE_TTL_MS,
  DEFAULT_PASSKEY_LABEL,
  MAX_PASSKEYS_PER_ACCOUNT,
  PASSKEY_LABEL_MAX_LENGTH,
  RECENT_SIGN_IN_WINDOW_MS,
  decideAddPasskey,
  decideRemovePasskey,
  decideUsePasskey,
  isAllowedPasskeyLabel,
  isPasskeySwitchOn,
  toChallengeExpiry,
  toPasskeyLabel,
  toRelyingParty,
} from './passkeys'

const now = new Date('2026-11-19T12:00:00.000Z')
const ago = (ms: number) => new Date(now.getTime() - ms)

describe('toRelyingParty: the ID and the origin come from the configured site address', () => {
  it('gives the live domain in production', () => {
    expect(toRelyingParty('https://sprechereast.com', { production: true })).toEqual({
      id: 'sprechereast.com',
      origin: 'https://sprechereast.com',
    })
  })

  it('keeps the port in the origin, not in the ID, and drops any path', () => {
    expect(
      toRelyingParty('https://preview.example.com:8443/some/page', { production: true }),
    ).toEqual({
      id: 'preview.example.com',
      origin: 'https://preview.example.com:8443',
    })
  })

  it('gives a preview its own address, never production’s', () => {
    expect(toRelyingParty('https://pr-12.preview.sprechereast.com', { production: true })).toEqual({
      id: 'pr-12.preview.sprechereast.com',
      origin: 'https://pr-12.preview.sprechereast.com',
    })
  })

  it('allows localhost over http in development only', () => {
    expect(toRelyingParty('http://localhost:3000', { production: false })).toEqual({
      id: 'localhost',
      origin: 'http://localhost:3000',
    })
    // The fallback of a missing site address, so production turns the feature off
    expect(toRelyingParty('http://localhost:3000', { production: true })).toBeNull()
    expect(toRelyingParty('https://localhost', { production: true })).toBeNull()
  })

  it('refuses plain http for any other host, even in development', () => {
    expect(toRelyingParty('http://sprechereast.com', { production: false })).toBeNull()
  })

  it.each([
    ['an IPv4 address', 'https://203.0.113.7'],
    ['an IPv6 address', 'https://[2001:db8::1]'],
    ['a bare host name', 'https://intranet'],
    ['nothing', ''],
    ['something that is not a URL', 'sprechereast.com'],
    ['another scheme', 'ftp://sprechereast.com'],
  ])('refuses %s', (_name, address) => {
    expect(toRelyingParty(address, { production: false })).toBeNull()
  })
})

describe('isPasskeySwitchOn: off unless the server setting says so', () => {
  it('is off when unset, blank or anything but "true"', () => {
    expect(isPasskeySwitchOn({})).toBe(false)
    expect(isPasskeySwitchOn({ PASSKEYS_ENABLED: '' })).toBe(false)
    expect(isPasskeySwitchOn({ PASSKEYS_ENABLED: 'false' })).toBe(false)
    expect(isPasskeySwitchOn({ PASSKEYS_ENABLED: '1' })).toBe(false)
    expect(isPasskeySwitchOn({ PASSKEYS_ENABLED: 'yes' })).toBe(false)
  })

  it('is on for "true", with stray spaces or capitals', () => {
    expect(isPasskeySwitchOn({ PASSKEYS_ENABLED: 'true' })).toBe(true)
    expect(isPasskeySwitchOn({ PASSKEYS_ENABLED: ' TRUE ' })).toBe(true)
  })
})

describe('toChallengeExpiry', () => {
  it('is the lifetime after now', () => {
    expect(toChallengeExpiry(now).getTime() - now.getTime()).toBe(CHALLENGE_TTL_MS)
  })

  it('is short: minutes, not hours', () => {
    expect(CHALLENGE_TTL_MS).toBeLessThanOrEqual(10 * 60 * 1000)
    expect(CHALLENGE_TTL_MS).toBeGreaterThan(0)
  })
})

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
  ])('neutralises %s, so the email can never carry a link or an address', (_name, raw, label) => {
    const clean = toPasskeyLabel(raw)
    expect(clean).toBe(label)
    expect(clean).not.toMatch(/[./:@<>&"]/)
  })

  it('falls back to the default when nothing allowed is left', () => {
    expect(toPasskeyLabel('...@@//')).toBe(DEFAULT_PASSKEY_LABEL)
  })

  it('keeps it to the length the list has room for', () => {
    const label = toPasskeyLabel('x'.repeat(500))
    expect(label).toHaveLength(PASSKEY_LABEL_MAX_LENGTH)
  })
})

describe('decideAddPasskey: who may add one', () => {
  const base = { accountId: 7, existingCount: 0, signedInAt: ago(60_000), now }

  it('lets a signed-in account with a recent sign-in add one', () => {
    expect(decideAddPasskey(base)).toEqual({ ok: true })
  })

  it('refuses nobody signed in', () => {
    expect(decideAddPasskey({ ...base, accountId: null })).toEqual({
      ok: false,
      reason: 'signed-out',
    })
  })

  it('refuses a sign-in older than the window, and asks to sign in again', () => {
    const old = ago(RECENT_SIGN_IN_WINDOW_MS + 1)
    expect(decideAddPasskey({ ...base, signedInAt: old })).toEqual({
      ok: false,
      reason: 'sign-in-again',
    })
  })

  it('allows a sign-in exactly at the edge of the window', () => {
    expect(decideAddPasskey({ ...base, signedInAt: ago(RECENT_SIGN_IN_WINDOW_MS) })).toEqual({
      ok: true,
    })
  })

  it.each([
    ['unknown', null],
    ['unreadable', new Date('nope')],
    ['in the future', new Date(now.getTime() + 60_000)],
  ])('counts a sign-in time that is %s as not recent', (_name, signedInAt) => {
    expect(decideAddPasskey({ ...base, signedInAt })).toEqual({
      ok: false,
      reason: 'sign-in-again',
    })
  })

  it('refuses at the cap, and allows one below it', () => {
    expect(decideAddPasskey({ ...base, existingCount: MAX_PASSKEYS_PER_ACCOUNT - 1 })).toEqual({
      ok: true,
    })
    expect(decideAddPasskey({ ...base, existingCount: MAX_PASSKEYS_PER_ACCOUNT })).toEqual({
      ok: false,
      reason: 'cap',
    })
  })

  it('has a few minutes for the window and a cap above one', () => {
    expect(RECENT_SIGN_IN_WINDOW_MS).toBeGreaterThanOrEqual(60_000)
    expect(RECENT_SIGN_IN_WINDOW_MS).toBeLessThanOrEqual(15 * 60_000)
    expect(MAX_PASSKEYS_PER_ACCOUNT).toBeGreaterThan(1)
  })
})

describe('decideRemovePasskey: who may remove one', () => {
  it('lets an account remove its own passkey', () => {
    expect(decideRemovePasskey({ accountId: 7, passkeyOwnerId: 7 })).toEqual({ ok: true })
  })

  it('refuses another account’s passkey', () => {
    expect(decideRemovePasskey({ accountId: 7, passkeyOwnerId: 8 })).toEqual({ ok: false })
  })

  it('refuses nobody signed in', () => {
    expect(decideRemovePasskey({ accountId: null, passkeyOwnerId: 8 })).toEqual({ ok: false })
  })

  it('refuses a passkey nobody owns', () => {
    expect(decideRemovePasskey({ accountId: 7, passkeyOwnerId: null })).toEqual({ ok: false })
  })

  it('allows removing the last one: email and password always remain', () => {
    // The rule takes no count: there is no case in which the last passkey is kept
    expect(decideRemovePasskey({ accountId: 7, passkeyOwnerId: 7 })).toEqual({ ok: true })
  })
})

describe('decideUsePasskey: who may sign in with one', () => {
  const owner = { id: 7, role: 'guest', verified: true, lockedUntil: null }
  const base = {
    passkeyOwnerId: 7,
    ownerHandle: 'handle-of-seven',
    answerHandle: 'handle-of-seven',
    owner,
    now,
  }

  it('signs in the credential’s owner when the handle matches', () => {
    expect(decideUsePasskey(base)).toEqual({ ok: true, accountId: 7 })
  })

  it('refuses a handle that is not the owner’s', () => {
    expect(decideUsePasskey({ ...base, answerHandle: 'handle-of-eight' })).toEqual({ ok: false })
  })

  it.each([
    ['no handle in the answer', { answerHandle: null }],
    ['no handle stored for the owner', { ownerHandle: null }],
    ['both handles empty', { ownerHandle: '', answerHandle: '' }],
    ['no owner found', { owner: null }],
    ['an owner other than the credential’s', { owner: { ...owner, id: 8 } }],
  ])('refuses %s', (_name, over) => {
    expect(decideUsePasskey({ ...base, ...over })).toEqual({ ok: false })
  })

  it('refuses a locked, unverified or agent account, as password and Google sign-in do', () => {
    const locked = { ...owner, lockedUntil: new Date(now.getTime() + 60_000) }
    expect(decideUsePasskey({ ...base, owner: locked })).toEqual({ ok: false })
    expect(decideUsePasskey({ ...base, owner: { ...owner, verified: false } })).toEqual({
      ok: false,
    })
    expect(decideUsePasskey({ ...base, owner: { ...owner, role: 'agent' } })).toEqual({ ok: false })
  })

  it('lets an account whose lock has passed sign in', () => {
    const past = { ...owner, lockedUntil: new Date(now.getTime() - 1) }
    expect(decideUsePasskey({ ...base, owner: past })).toEqual({ ok: true, accountId: 7 })
  })
})

describe('isAllowedPasskeyLabel: what a neighbor may type', () => {
  it.each(['', 'My phone', 'Ada’s laptop', 'Téléphone 2'])('accepts %j', (label) => {
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
    'x'.repeat(PASSKEY_LABEL_MAX_LENGTH + 1),
  ])('refuses %j', (label) => {
    expect(isAllowedPasskeyLabel(label)).toBe(false)
  })
})
