import { randomBytes, randomInt } from 'node:crypto'
import { createRequire } from 'node:module'

import { test as base, expect, type Page } from '@playwright/test'

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js')

let visitors = 0
// A different block of addresses each run, so a rerun never meets an earlier run's counts
const run = randomInt(20, 220)

/**
 * The tests' `test`: each test is a different visitor, with its own address in X-Forwarded-For
 * (which the site reads as the client IP, `parseClientIp`), so the per-connection limits on the
 * public forms count each test on its own, as they would count different residents. The
 * site-wide limits still apply to the whole run.
 */
export const test = base.extend({
  // The fixture's callback is named `provide`, not `use`: lint reads `use` as a React hook
  context: async ({ context }, provide) => {
    visitors++
    await context.setExtraHTTPHeaders({
      'x-forwarded-for': `10.${run}.${visitors >> 8}.${visitors % 256}`,
    })
    await provide(context)
  },
})

export { expect }

/** A new address no account or message uses yet. */
export const newEmail = (who: string) =>
  `${who}-${Date.now()}-${randomBytes(3).toString('hex')}@example.com`

/** A password that passes the site's rules. */
export const newPassword = () => `Neighbor-${randomBytes(6).toString('base64url')}-2026`

/** Runs axe on the page as it stands, WCAG 2.2 AA, and fails with the rules it breaks. */
export async function expectAccessible(page: Page) {
  await page.addScriptTag({ path: axePath })
  const violations = await page.evaluate(async () => {
    const result = await (
      window as unknown as {
        axe: {
          run: (
            ctx: Document,
            opts: object,
          ) => Promise<{ violations: { id: string; help: string }[] }>
        }
      }
    ).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })
    return result.violations.map(({ id, help }) => `${id}: ${help}`)
  })
  expect(violations).toEqual([])
}
