// The showcase's screen widths. The design guideline's viewport table is the one definition of the
// six widths (docs/guidelines/nextjs-tailwind.md), so this reads that table instead of repeating
// its numbers; viewports.test.ts checks the list still matches the table.
import guideline from '../docs/guidelines/nextjs-tailwind.md?raw'

export type Viewport = { name: string; width: number }

/** A table row such as `| 1 | Mobile S | 320px | iPhone SE |` gives its name and width */
const ROW = /^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*(\d+)px\s*\|/gm

// Only the guideline's viewport section: another table with a px column must not join the list
const SECTION = /^## Responsive Design — 6-Viewport Testing$([\s\S]*?)(?=^## |(?![\s\S]))/m

export function parseViewports(markdown: string): Viewport[] {
  const section = markdown.match(SECTION)?.[1] ?? ''
  const viewports = [...section.matchAll(ROW)].map(([, name, width]) => ({
    name,
    width: Number(width),
  }))
  if (viewports.length === 0) {
    throw new Error('The viewport table is missing from docs/guidelines/nextjs-tailwind.md')
  }
  return viewports
}

export const VIEWPORTS = parseViewports(guideline)

/** The options of Storybook's viewport toolbar, keyed by the width */
export function viewportOptions(viewports: Viewport[]) {
  return Object.fromEntries(
    viewports.map(({ name, width }) => [
      `w${width}`,
      { name: `${name} (${width}px)`, styles: { width: `${width}px`, height: '100%' } },
    ]),
  )
}
