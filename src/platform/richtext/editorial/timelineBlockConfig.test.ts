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

  it('says why under the field while Admin counts the rows, and clears it at the second row', async () => {
    const building = { ...args, event: 'onChange' }
    expect(await validate(1, building)).toMatch(/^Add 2 to 12 milestones: there is 1/)
    expect(await validate(13, building)).toMatch(/^Add 2 to 12 milestones: there are 13/)
    expect(await validate([{ id: 'a' }], building)).toMatch(/there is 1/)
    expect(await validate([{ id: 'a' }, { id: 'b' }], building)).toBe(true)
    expect(await validate(2, building)).toBe(true)
    expect(await validate(12, building)).toBe(true)
  })

  it('gives no opinion on what Admin sends that cannot be counted, and never throws', async () => {
    const building = { ...args, event: 'onChange' }
    for (const value of [undefined, null, 'x']) {
      expect(await validate(value, building)).toBe(true)
    }
    // Two "Next up" is still said on an array: the rows exist
    expect(await validate([{ status: 'next' }, { status: 'next' }], building)).toMatch(/only one/)
  })
})
