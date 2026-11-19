import { describe, expect, it } from 'vitest'

import { validateLabel } from './diagramKeyBlockConfig'

// What Payload passes a text field's validator, as far as these checks read it
const args = {
  required: true,
  maxLength: 40,
  req: { payload: { config: {} }, t: (key: string) => key },
} as unknown as Parameters<typeof validateLabel>[1]

describe('the diagram key label', () => {
  it('refuses a label of only spaces', async () => {
    expect(await validateLabel('   ', args)).toMatch(/Add a label/)
  })

  it('accepts a real label and still refuses an empty one', async () => {
    expect(await validateLabel('North roundabout', args)).toBe(true)
    expect(await validateLabel('', args)).not.toBe(true)
  })
})
