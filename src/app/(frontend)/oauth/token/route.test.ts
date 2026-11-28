import { beforeEach, describe, expect, it, vi } from 'vitest'

// The agents module is replaced: this tests how the route reads the request, not the sign-in
const mocks = vi.hoisted(() => ({ exchangeToken: vi.fn() }))
vi.mock('@/modules/agents/server', () => ({ exchangeToken: mocks.exchangeToken }))

import { NO_STORE_HEADERS } from '@/modules/agents'

import { POST } from './route'

const FORM = 'application/x-www-form-urlencoded'
const post = (body: string, type = FORM, extra: Record<string, string> = {}) =>
  POST(
    new Request('https://example.com/oauth/token', {
      method: 'POST',
      headers: { 'content-type': type, ...extra },
      body,
    }),
  )

beforeEach(() => {
  mocks.exchangeToken
    .mockReset()
    .mockResolvedValue({ status: 200, headers: NO_STORE_HEADERS, body: { ok: true } })
})

describe('POST /oauth/token', () => {
  it('reads the form into plain strings and hands it on with the request headers', async () => {
    const response = await post('grant_type=refresh_token&refresh_token=ser_x', FORM, {
      'x-forwarded-for': '203.0.113.5',
    })
    expect(response.status).toBe(200)
    const [form, headers] = mocks.exchangeToken.mock.lastCall ?? []
    expect(form).toEqual({ grant_type: 'refresh_token', refresh_token: 'ser_x' })
    expect(headers?.get('x-forwarded-for')).toBe('203.0.113.5')
  })

  it('hands a repeated field on as a list, for the exchange to refuse', async () => {
    await post('grant_type=a&resource=one&resource=two&resource=three')
    expect(mocks.exchangeToken).toHaveBeenCalledWith(
      expect.objectContaining({ resource: ['one', 'two', 'three'] }),
      expect.anything(),
    )
  })

  it('treats a field named like an object member as any other field, sent once', async () => {
    await post('grant_type=a&constructor=x&toString=y&hasOwnProperty=z&__proto__=w')
    const [form] = mocks.exchangeToken.mock.lastCall ?? []
    expect(Object.entries(form ?? {})).toEqual([
      ['grant_type', 'a'],
      ['constructor', 'x'],
      ['toString', 'y'],
      ['hasOwnProperty', 'z'],
      ['__proto__', 'w'],
    ])
  })

  it('never lets a cache or the browser keep a token', async () => {
    const response = await post('grant_type=refresh_token')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('pragma')).toBe('no-cache')
  })

  it.each([
    ['a body sent as json', () => post('grant_type=x', 'application/json')],
    ['a body that is too big', () => post(`grant_type=x&junk=${'a'.repeat(9000)}`)],
  ])(
    'keeps the early refusal of %s out of every cache, as any token answer is',
    async (_n, send) => {
      const response = await send()
      expect(response.status).toBe(400)
      expect(response.headers.get('cache-control')).toBe('no-store')
      expect(response.headers.get('pragma')).toBe('no-cache')
      expect(await response.json()).toMatchObject({ error: 'invalid_request' })
    },
  )

  it('passes on the answer and its headers', async () => {
    mocks.exchangeToken.mockResolvedValue({
      status: 400,
      headers: { 'X-Test': '1' },
      body: { error: 'invalid_grant' },
    })
    const response = await post('grant_type=authorization_code')
    expect(response.status).toBe(400)
    expect(response.headers.get('x-test')).toBe('1')
    expect(await response.json()).toEqual({ error: 'invalid_grant' })
  })

  it.each(['application/json', 'text/plain', 'multipart/form-data; boundary=x', ''])(
    'refuses a body sent as %j',
    async (type) => {
      const response = await post('grant_type=refresh_token', type)
      expect(response.status).toBe(400)
      expect((await response.json()).error).toBe('invalid_request')
      expect(mocks.exchangeToken).not.toHaveBeenCalled()
    },
  )

  it('accepts a charset on the form type', async () => {
    expect((await post('grant_type=x', `${FORM}; charset=UTF-8`)).status).toBe(200)
  })

  it('refuses a body that is far bigger than a token request', async () => {
    const response = await post(`grant_type=x&junk=${'a'.repeat(9000)}`)
    expect(response.status).toBe(400)
    expect(mocks.exchangeToken).not.toHaveBeenCalled()
  })

  it('stops reading a body that never states its length once it is over the limit', async () => {
    let pulls = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++
        controller.enqueue(new TextEncoder().encode('a'.repeat(4096)))
      },
    })
    const response = await POST(
      new Request('https://example.com/oauth/token', {
        method: 'POST',
        headers: { 'content-type': FORM },
        body,
        // @ts-expect-error `duplex` is required to send a stream body and is missing from the types
        duplex: 'half',
      }),
    )
    expect(response.status).toBe(400)
    // An endless body would have kept this loop going; the limit stops it after a few pieces
    expect(pulls).toBeLessThan(10)
    expect(mocks.exchangeToken).not.toHaveBeenCalled()
  })

  it('sets no CORS header: a web page has no business here', async () => {
    const response = await post('grant_type=x')
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })
})
