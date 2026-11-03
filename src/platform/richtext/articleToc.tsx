import React from 'react'

import type { RichTextValue } from '@/platform/lib'
import { hasOnThisPage } from '@/platform/ui/onThisPage'
import { OnThisPage } from '@/platform/ui/OnThisPage.client'

import { headingAnchors } from './headingAnchors'

/**
 * The "On this page" menu for an article's rich text (#574), or nothing when it has fewer than
 * three sections. The one place post and event pages get their `DetailLayout` `toc` from.
 */
export function articleToc(content: RichTextValue | null): React.ReactNode {
  const sections = headingAnchors(content)
  return hasOnThisPage(sections) ? <OnThisPage sections={sections} /> : undefined
}
