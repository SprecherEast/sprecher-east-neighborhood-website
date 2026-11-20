import type * as PayloadModule from 'payload'
import { vi } from 'vitest'

// For the server action tests: the edges are replaced (Payload's operations, its Next.js sign-in
// helper and Next's request APIs); the actions, use cases, data functions and Payload's own cookie
// generators under them run for real. A test file mocks with these factories, then imports the
// actions:
//
//   vi.mock('payload', async (importActual) => payloadWithEdges(await importActual()))
//   vi.mock('@payloadcms/next/auth', () => nextAuthWithEdges())
//   vi.mock('@payload-config', () => ({ default: {} }))
//   vi.mock('next/headers', () => nextHeadersWithEdges())
//   vi.mock('next/server', async (importActual) => nextServerWithEdges(await importActual()))
//   vi.mock('@/platform/turnstile/turnstileVerifier', () => robotCheckWithEdges())

export const edges = {
  auth: vi.fn(),
  update: vi.fn(),
  login: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  find: vi.fn(),
  dbUpdateOne: vi.fn(),
  sendEmail: vi.fn(),
  verifyEmail: vi.fn(),
  logoutOperation: vi.fn(),
  /** `login` from `@payloadcms/next/auth`: Payload's sign-in, which also sets the cookie */
  signInHelper: vi.fn(),
  deleteCookie: vi.fn(),
  /** A cookie the request sent: none unless a test says so */
  getCookie: vi.fn(),
  setCookie: vi.fn(),
}

/** Payload's defaults for a collection with `auth: true` */
export const users = {
  config: { auth: { cookies: { sameSite: 'Lax', secure: false }, tokenExpiration: 7200 } },
}

export const payloadWithEdges = (actual: typeof PayloadModule) => ({
  ...actual,
  getPayload: async () => ({
    auth: edges.auth,
    update: edges.update,
    login: edges.login,
    forgotPassword: edges.forgotPassword,
    resetPassword: edges.resetPassword,
    create: edges.create,
    delete: edges.delete,
    find: edges.find,
    db: { updateOne: edges.dbUpdateOne },
    sendEmail: edges.sendEmail,
    verifyEmail: edges.verifyEmail,
    collections: { users },
    config: { cookiePrefix: 'payload' },
  }),
  createLocalReq: async ({ user }: { user: unknown }) => ({ user }),
  logoutOperation: edges.logoutOperation,
})

/** The request's headers; a test sets `x-forwarded-for` here to act as a connection */
export const requestHeaders = new Headers({ cookie: 'payload-token=abc' })

export const nextHeadersWithEdges = () => ({
  headers: async () => requestHeaders,
  cookies: async () => ({ get: edges.getCookie, set: edges.setCookie, delete: edges.deleteCookie }),
})

export const nextAuthWithEdges = () => ({ login: edges.signInHelper })

/** Work a use case gave Next's `after()`, to run once the response is sent: see `runAfterTasks` */
export const afterTasks: Array<() => unknown> = []

export const nextServerWithEdges = (actual: object) => ({
  ...actual,
  after: (task: () => unknown) => {
    afterTasks.push(task)
  },
})

/** Runs the work queued with `after()`, as Next does once the response is sent. */
export async function runAfterTasks() {
  for (const task of afterTasks.splice(0)) await task()
}

/** The robot check (Cloudflare Turnstile), replaced: on, and passing unless a test says otherwise */
export const robotCheck = { enabled: true, verify: vi.fn() }

export const robotCheckWithEdges = () => ({
  TurnstileVerifier: class {
    isEnabled = () => robotCheck.enabled
    verify = (token: unknown) => robotCheck.verify(token)
  },
})

/** The signed-in resident, as `payload.auth` returns it (with its session id) */
export const resident = {
  id: 7,
  email: 'ada@example.com',
  name: 'Ada',
  role: 'resident',
  collection: 'users',
  _sid: 's7',
}

/** Resets every edge and silences (and records) the server log. */
export function resetEdges() {
  for (const fn of Object.values(edges)) fn.mockReset()
  requestHeaders.delete('x-forwarded-for')
  afterTasks.length = 0
  robotCheck.enabled = true
  robotCheck.verify.mockReset().mockResolvedValue({ ok: true })
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
}
