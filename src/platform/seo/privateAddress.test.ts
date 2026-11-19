import { describe, expect, it } from 'vitest'

import { NOT_INDEXED } from './notIndexed'
import { privateAddressMetadata } from './privateAddress'

describe('privateAddressMetadata', () => {
  it('names the page, keeps it out of search results, and stops the address leaving the site', () => {
    expect(privateAddressMetadata('Create an Account', 'Create a free account.')).toEqual({
      title: 'Create an Account',
      description: 'Create a free account.',
      referrer: 'no-referrer',
      robots: NOT_INDEXED,
    })
  })
})
