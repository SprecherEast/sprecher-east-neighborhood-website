import { describe, expect, it } from 'vitest'

import { readLimitedBody } from './readLimitedBody'

/** A POST whose body arrives in the given pieces and states no length, as a chunked one does */
const chunked = (pieces: string[], onPull?: () => void) =>
  new Request('https://example.com/', {
    method: 'POST',
    body: new ReadableStream<Uint8Array>({
      pull(controller) {
        onPull?.()
        const next = pieces.shift()
        if (next === undefined) controller.close()
        else controller.enqueue(new TextEncoder().encode(next))
      },
    }),
    // @ts-expect-error `duplex` is required to send a stream body and is missing from the types
    duplex: 'half',
  })

describe('readLimitedBody', () => {
  it('reads a body within the limit, in as many pieces as it comes', async () => {
    expect(await readLimitedBody(chunked(['grant_type=', 'refresh_token']), 100)).toBe(
      'grant_type=refresh_token',
    )
  })

  it('reads a body of exactly the limit', async () => {
    expect(await readLimitedBody(chunked(['abcd']), 4)).toBe('abcd')
  })

  it('gives null for a body over the limit and stops reading it', async () => {
    let pulls = 0
    const pieces = Array.from({ length: 50 }, () => 'x'.repeat(10))
    expect(
      await readLimitedBody(
        chunked(pieces, () => pulls++),
        25,
      ),
    ).toBeNull()
    // Three pieces took it past the limit; the other forty-seven were never asked for
    expect(pulls).toBeLessThan(10)
  })

  it('counts bytes, not characters', async () => {
    expect(await readLimitedBody(chunked(['éééé']), 7)).toBeNull()
  })

  it('reads a request with no body as empty', async () => {
    expect(await readLimitedBody(new Request('https://example.com/'), 10)).toBe('')
  })
})
