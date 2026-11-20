import { describe, expect, it } from 'vitest'

import { toPasskeyAddedEmail } from './passkeyEmail'

const at = new Date('2026-11-19T23:05:00.000Z')

describe('toPasskeyAddedEmail', () => {
  const email = toPasskeyAddedEmail({ label: 'My phone', at })

  it('names the passkey and the time, in the site’s time zone', () => {
    expect(email.text).toContain('“My phone”')
    expect(email.text).toContain('Nov 19, 2026, 5:05 PM CST')
    expect(email.html).toContain('“My phone”')
  })

  it('tells the person what to do if it wasn’t them, without a link to sign in', () => {
    expect(email.text).toMatch(/Forgot your password\?/)
    expect(email.text).toMatch(/remove the passkey/)
    for (const part of [email.subject, email.text, email.html]) {
      expect(part).not.toMatch(/https?:|www\.|href=|@/i)
    }
  })

  it('keeps to the email length limits of the brand voice', () => {
    expect(email.subject.length).toBeLessThan(50)
    expect(email.text.split(/\s+/).length).toBeLessThanOrEqual(120)
  })

  it('never puts the label in the subject, and escapes it in the HTML', () => {
    const tricky = toPasskeyAddedEmail({ label: '<b>Phone</b> & "co"', at })
    expect(tricky.subject).toBe(email.subject)
    expect(tricky.html).not.toContain('<b>Phone</b>')
    expect(tricky.html).toContain('&lt;b&gt;Phone&lt;/b&gt;')
  })
})
