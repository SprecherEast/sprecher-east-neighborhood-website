import type { Locator } from '@playwright/test'

import { expect, test } from './support/test'

// A control smaller than 44 px keeps a 44 x 44 px tap area (WCAG 2.5.8), made by one shared class,
// `TOUCH_TARGET` (src/platform/ui/touchTarget.ts). jsdom has no layout, so the unit tests pin only
// the class; here a browser measures what it draws. The checkbox on the log in page stands for
// every control that uses the class, the switch included (no page uses the switch yet, and the
// development gallery is not in the production build these tests run against; the switch's
// tap area was measured the same way in the gallery at 320 and 1280 px, 44 x 44 px).

const TARGET = 44

/** The size of the control's tap area, and whether a press 21 and 23 px from its centre reaches it */
async function measureTarget(control: Locator) {
  return control.evaluate((element, target) => {
    // Centred in the window, clear of the sticky header, so every point measured is on screen
    element.scrollIntoView({ block: 'center', behavior: 'instant' })
    const area = getComputedStyle(element, '::after')
    const box = element.getBoundingClientRect()
    const centre = { x: box.left + box.width / 2, y: box.top + box.height / 2 }
    const reaches = (dx: number, dy: number) =>
      document.elementFromPoint(centre.x + dx, centre.y + dy) === element
    const half = target / 2
    return {
      width: parseFloat(area.width),
      height: parseFloat(area.height),
      insideEdges: [
        reaches(half - 1, 0),
        reaches(-(half - 1), 0),
        reaches(0, half - 1),
        reaches(0, -(half - 1)),
      ],
      outsideEdges: [
        reaches(half + 1, 0),
        reaches(-(half + 1), 0),
        reaches(0, half + 1),
        reaches(0, -(half + 1)),
      ],
    }
  }, TARGET)
}

test.describe('touch targets', () => {
  test('the checkbox has a 44 px tap area, no less and no more', async ({ page }) => {
    await page.goto('/login')

    const measured = await measureTarget(page.getByRole('checkbox'))

    expect(measured.width).toBe(TARGET)
    expect(measured.height).toBe(TARGET)
    expect(measured.insideEdges).toEqual([true, true, true, true])
    expect(measured.outsideEdges).toEqual([false, false, false, false])
  })
})
