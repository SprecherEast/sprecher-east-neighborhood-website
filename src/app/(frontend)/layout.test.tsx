import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

// Only what the layout composes is checked, so nothing is rendered: the parts that load data,
// fonts or styles at import are replaced with stand-ins.
vi.mock('next/font/google', () => ({ Poppins: () => ({ variable: 'font-poppins' }) }))
const draft = vi.hoisted(() => ({ isEnabled: false }))
vi.mock('next/headers', () => ({ draftMode: async () => draft }))
vi.mock('@/modules/site/server', () => ({ SiteHeader: () => null, SiteFooter: () => null }))
vi.mock('@/platform/ui/AdminBar.client', () => ({ AdminBar: () => null }))
vi.mock('@/modules/accounts/server', () => ({
  AccountMenu: () => null,
  AccountProvider: ({ children }: { children: ReactNode }) => children,
}))

import { SiteHeader } from '@/modules/site/server'
import { AccountMenu, AccountProvider } from '@/modules/accounts/server'
import { LikelyHumanClicks } from '@/platform/analytics/LikelyHumanClicks.client'
import { UmamiScript } from '@/platform/analytics/UmamiScript'

import RootLayout from './layout'

type Props = { children?: ReactNode } & Record<string, unknown>

/** Every element in the tree, parents before children. */
function elements(node: ReactNode): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Props>(node)) return []
  return [node, ...elements(node.props.children)]
}

describe('RootLayout', () => {
  it('gives the header the accounts module’s menus, inside one AccountProvider', async () => {
    const tree = elements(await RootLayout({ children: null }))

    const provider = tree.find((element) => element.type === AccountProvider)
    const header = elements(provider?.props.children).find((element) => element.type === SiteHeader)
    expect(header).toBeDefined()

    const { accountMenu, mobileAccountMenu } = header?.props ?? {}
    for (const [slot, variant] of [
      [accountMenu, 'bar'],
      [mobileAccountMenu, 'drawer'],
    ] as const) {
      expect(isValidElement(slot) && slot.type).toBe(AccountMenu)
      expect(isValidElement<{ variant?: string }>(slot) && slot.props.variant).toBe(variant)
    }
  })

  it.each([
    ['visits', UmamiScript],
    ['likely-human clicks', LikelyHumanClicks],
  ])('counts %s on public pages, but not in a draft preview (#950, #975)', async (_what, part) => {
    const found = async () =>
      elements(await RootLayout({ children: null })).some((element) => element.type === part)

    expect(await found()).toBe(true)
    draft.isEnabled = true
    expect(await found()).toBe(false)
    draft.isEnabled = false
  })
})
