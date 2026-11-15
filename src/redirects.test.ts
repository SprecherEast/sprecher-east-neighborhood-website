import { describe, expect, it } from 'vitest'

import { RESOURCE_GROUPS, resourceGroupHref } from '@/modules/directory'

import redirects from '../redirects.js'

describe('the redirects next.config.js sends', () => {
  it('no longer sends Internet Explorer visitors to a page that does not exist', async () => {
    const rules = await redirects()

    expect(JSON.stringify(rules)).not.toMatch(/Trident|ie-incompatible/)
  })

  it('is still a function that next.config.js can call for a list', async () => {
    expect(Array.isArray(await redirects())).toBe(true)
  })

  it('sends the old Resources page to the first group, for good', async () => {
    const rules = await redirects()

    expect(rules).toContainEqual({
      source: '/resources',
      destination: resourceGroupHref(RESOURCE_GROUPS[0].id),
      permanent: true,
    })
  })
})
