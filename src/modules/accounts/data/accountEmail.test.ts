import { describe, expect, it, vi } from 'vitest'

const sendEmail = vi.hoisted(() => vi.fn())
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({ sendEmail }) }))

import { sendEmailToAccount } from './accountEmail'

describe('sendEmailToAccount', () => {
  it('sends the subject, text and HTML to the address, and nothing else', async () => {
    await sendEmailToAccount('ada@example.com', { subject: 'S', text: 'T', html: '<p>H</p>' })
    expect(sendEmail).toHaveBeenCalledExactlyOnceWith({
      to: 'ada@example.com',
      subject: 'S',
      text: 'T',
      html: '<p>H</p>',
    })
  })

  it('throws when sending fails, so the caller can log it', async () => {
    sendEmail.mockRejectedValueOnce(new Error('smtp down'))
    await expect(
      sendEmailToAccount('ada@example.com', { subject: 'S', text: 'T', html: 'H' }),
    ).rejects.toThrow('smtp down')
  })
})
