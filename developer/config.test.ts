import { describe, expect, it } from 'vitest'

import config from './next.config.mjs'

describe('the developer pages build', () => {
  it('exports plain files for a file server, with a folder per page', () => {
    expect(config.output).toBe('export')
    expect(config.trailingSlash).toBe(true)
  })

  it('needs no image optimizer, which a static export does not have', () => {
    expect(config.images).toEqual({ unoptimized: true })
  })
})
