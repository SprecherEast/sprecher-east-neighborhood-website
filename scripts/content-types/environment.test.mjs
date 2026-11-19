import { describe, expect, it } from 'vitest'

import { GENERATOR_ENV, pinEnvironment } from './environment.mjs'

describe('pinEnvironment', () => {
  it('overrides what the machine has set, so CI and a laptop write the same pages', () => {
    const env = { NODE_ENV: 'development', PAYLOAD_SECRET: 'mine', DATABASE_URI: 'file:./x.db' }
    pinEnvironment(env)
    expect(env).toEqual(GENERATOR_ENV)
  })

  it('pins production, which is how the live site runs (the sign-in cookie is Secure there)', () => {
    expect(GENERATOR_ENV.NODE_ENV).toBe('production')
  })

  it('leaves other variables alone', () => {
    const env = { PATH: '/bin' }
    pinEnvironment(env)
    expect(env.PATH).toBe('/bin')
  })
})
