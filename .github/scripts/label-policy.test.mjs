import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const policy = JSON.parse(readFileSync(new URL('../label-policy.json', import.meta.url), 'utf8'))

// GitHub's limit for a label description (REST: create a label). A longer one is a validation error
const DESCRIPTION_LIMIT = 100

describe('label-policy.json', () => {
  it("keeps every marker description within GitHub's label description limit", () => {
    for (const [name, description] of Object.entries(policy.markers)) {
      expect(description.length, name).toBeLessThanOrEqual(DESCRIPTION_LIMIT)
    }
  })

  it('has a marker for the label the issue check creates', () => {
    expect(policy.markers['needs grooming']).toBeTruthy()
  })
})
