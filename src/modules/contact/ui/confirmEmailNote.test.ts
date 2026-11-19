import { CONFIRMATION_LINK_LIFETIME_MS, formatDuration } from '@/platform/lib'
import { describe, expect, it } from 'vitest'

import { CONFIRM_EMAIL_NOTE } from './confirmEmailNote'

describe('the contact confirmation note (#551)', () => {
  it('is short and warm, and names the real link lifetime', () => {
    expect(CONFIRM_EMAIL_NOTE).toBe(
      'Check your email. First time writing? Tap the link within a day so your message reaches us.',
    )
    expect(CONFIRM_EMAIL_NOTE).toContain(formatDuration(CONFIRMATION_LINK_LIFETIME_MS))
  })
})
