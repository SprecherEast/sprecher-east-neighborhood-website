import { expect, type Locator, type Page } from '@playwright/test'

import { E2E } from './settings.mjs'

// The people and the AI tool the connection spec uses (#1501). The seed (`e2e/seed.ts`) makes the
// accounts and registers the tool in the throwaway test database; this password opens nothing
// else, since that database is wiped at every start.
export const CONNECT = {
  adminEmail: 'connect-admin@example.com',
  guestEmail: 'connect-guest@example.com',
  agentEmail: 'connect-agent@example.com',
  password: 'Neighbor-Connect-Pass-2026',
  clientName: 'Claude',
  agentName: 'Connect Scout',
  /** The one address the tool is registered to return to; served by `routeTheTool` */
  redirect: 'https://claude.example/cb',
}

const TOOL_ORIGIN = 'https://claude.example'

/** The AI tool's request, as its own site builds it: PKCE S256, a state and the MCP address. */
export function connectionRequest(clientId: string, state: string) {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: CONNECT.redirect,
    code_challenge: 'A'.repeat(43),
    code_challenge_method: 'S256',
    state,
    resource: `${E2E.baseURL}/api/mcp`,
  })
  return `${E2E.baseURL}/oauth/authorize?${query.toString()}`
}

/**
 * Stands in for the AI tool's site: a page on another origin with one link to the site, so the
 * visit to `/oauth/authorize` is a real cross-site navigation (`Sec-Fetch-Site: cross-site`, no
 * `Origin`) as it is from the Claude connector, and the redirect back lands on a page there.
 */
export async function routeTheTool(page: Page, authorizeUrl: string) {
  await page.route(`${TOOL_ORIGIN}/**`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><title>The AI tool</title><p>The AI tool</p><a href="${authorizeUrl.replaceAll('&', '&amp;')}">Connect</a>`,
    }),
  )
}

/**
 * Waits until React has taken over the server-rendered element: it then holds its props. A press
 * before that is a form post by the browser itself (which works, and has its own tests), and the
 * stand-in site of `routeTheTool` can't serve the redirect it ends in.
 */
export const hydrated = (element: Locator) =>
  expect
    .poll(() =>
      element.evaluate((node) => Object.keys(node).some((k) => k.startsWith('__reactProps'))),
    )
    .toBe(true)
