import type { ArrayField } from 'payload'
import { describe, expect, it } from 'vitest'

import { TimelineBlockConfig } from './timelineBlockConfig'

const entries = TimelineBlockConfig.fields.find(
  (field): field is ArrayField => 'name' in field && field.name === 'entries',
)
if (!entries?.validate) throw new Error('The timeline has no validated entries field')
// Admin's form state sends a number where the rows will be, which the typed validator doesn't allow
const validate = entries.validate as unknown as (value: unknown, args: object) => true | string

// What Payload passes the array's validator, as far as these checks read it
const args = {
  minRows: 2,
  maxRows: 12,
  required: true,
  req: { t: (key: string) => key },
}

describe('the timeline block', () => {
  it('lets one milestone be "Next up"', async () => {
    const value = [{ status: 'done' }, { status: 'next' }, { status: 'later' }]
    expect(await validate(value, args)).toBe(true)
  })

  it('refuses two milestones marked "Next up"', async () => {
    const value = [{ status: 'next' }, { status: 'next' }]
    expect(await validate(value, args)).toMatch(/only one milestone/)
  })

  it('still applies the row limits, and reads a number as no rows on the real save', async () => {
    expect(await validate([{ status: 'done' }], args)).not.toBe(true)
    expect(await validate(2, args)).toMatch(/^Add 2 to 12 milestones: there are 0/)
    expect(await validate(2, { ...args, event: 'submit' })).not.toBe(true)
  })

  it('gives no opinion while Admin builds the form, and never throws on what it sends', async () => {
    const building = { ...args, event: 'onChange' }
    for (const value of [0, 2, [], [{ id: 'x' }], undefined, null]) {
      expect(await validate(value, building)).toBe(true)
    }
    // Two "Next up" is still said on an array: the rows exist
    expect(await validate([{ status: 'next' }, { status: 'next' }], building)).toMatch(/only one/)
  })
})
