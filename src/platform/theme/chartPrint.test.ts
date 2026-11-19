import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

// Chart marks and key swatches are background colours, which a printer drops unless the reader
// turns on "background graphics". `print-exact` keeps them, so a printed grid still shows its squares.
const css = readFileSync(join(process.cwd(), 'src/platform/theme/tailwind.css'), 'utf8')
const utility = css.slice(css.indexOf('@utility print-exact'))
const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8')

describe('print-exact', () => {
  it('asks the browser to print colours exactly, with the WebKit prefix', () => {
    expect(css).toContain('@utility print-exact')
    expect(utility).toContain('print-color-adjust: exact')
    expect(utility).toContain('-webkit-print-color-adjust: exact')
  })

  it.each([
    'src/platform/ui/chart/adapters/css/UnitGrid.tsx',
    'src/platform/ui/chart/adapters/visx/BarChartSvg.tsx',
    'src/platform/ui/Legend.tsx',
  ])('is on the marks drawn in %s', (file) => {
    expect(source(file)).toContain('print-exact')
  })
})
