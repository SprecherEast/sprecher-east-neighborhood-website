import { describe, expect, it } from 'vitest'

import { toGoogleConnectedEmail } from './googleConnectedEmail'

const email = toGoogleConnectedEmail({ at: new Date('2026-11-20T23:05:00.000Z') })

describe('toGoogleConnectedEmail', () => {
  it('names the time, in the site’s time zone', () => {
    expect(email.text).toContain('Nov 20, 2026, 5:05 PM CST')
    expect(email.html).toContain('Nov 20, 2026, 5:05 PM CST')
  })

  it('tells the person what to do if it wasn’t them, with no link or address to sign in', () => {
    expect(email.text).toMatch(/Forgot your password\?/)
    expect(email.text).toMatch(/change your password/)
    expect(email.text).toMatch(/contact form/)
    expect(email.text).not.toMatch(/disconnect/i)
    for (const part of [email.subject, email.text, email.html]) {
      expect(part).not.toMatch(/https?:|www\.|href=|@/i)
    }
  })

  it('keeps to the email length limits of the brand voice', () => {
    expect(email.subject.length).toBeLessThan(50)
    expect(email.text.split(/\s+/).length).toBeLessThanOrEqual(120)
  })
})
