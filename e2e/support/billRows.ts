import type { Page } from '@playwright/test'

import { BILL_POST_SLUG } from './alignmentSlug'

/** The seeded post with the whole-bill tab (`billPage.ts`), as the browser tests reach it */
export const BILL_POST_PATH = `/posts/${BILL_POST_SLUG}`
/** The widths the tab is measured at: two phones, a tablet and a desktop */
export const BILL_WIDTHS = [320, 390, 768, 1280]
/** The three open-and-close rows under the whole bill, in order */
export const BILL_ROW_TITLES = ['Your City tax breakdown', 'How we estimate this', 'Sources']

/** The summary row whose whole text is `title` */
export const summaryRow = (page: Page, title: string) =>
  page.locator('summary', { hasText: new RegExp(`^${title}$`) })
