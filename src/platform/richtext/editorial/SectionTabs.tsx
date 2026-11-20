import React from 'react'

import { cn } from '@/platform/lib/cn'
import { Tabs, type TabsItem } from '@/platform/ui/Tabs.client'

import { tabAnchors } from './tabAnchors'

/** One tab as the page draws it: its label and its content, already drawn */
export type SectionTabView = { label: string; content: React.ReactNode }

/**
 * An article split into tabs of ordinary content (#1333): the shared `Tabs` (equal label-only
 * buttons in one row, the content directly under them in the same column, every panel on the
 * server so with scripting off they read one after another under their labels). The content of a
 * tab arrives drawn, so this knows nothing of rich text. It clears any floated picture before it,
 * so the buttons and what they open stay in one column under an introduction and its picture. It
 * is not `not-prose`: the content of a tab is article text, and Tailwind's typography skips
 * everything under a `not-prose` ancestor, even a nested `prose`.
 */
export function SectionTabs({ tabs, className }: { tabs: SectionTabView[]; className?: string }) {
  if (tabs.length === 0) return null
  const anchors = tabAnchors(tabs.map((tab) => tab.label))
  const items: TabsItem[] = tabs.map((tab, index) => ({
    value: `tab-${index}`,
    anchor: anchors[index],
    trigger: tab.label,
    heading: tab.label,
    panel: tab.content,
  }))
  return (
    <Tabs
      label="Sections of this article"
      items={items}
      defaultValue="tab-0"
      headingAs="h2"
      className={cn('clear-both my-8 w-full', className)}
    />
  )
}
