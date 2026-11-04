import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

/*
 * The CHART_LIBRARIES policy in eslint.boundaries.config.mjs (#639): lint itself is run on small
 * sources placed at real paths, so the test fails if the policy stops firing.
 */
const MESSAGE = 'Chart libraries only inside src/platform/ui/chart/adapters/'
const eslint = new ESLint({ cwd: process.cwd() })

async function messagesFor(filePath: string, importLine: string) {
  const [result] = await eslint.lintText(`${importLine}\nexport const x = 1\n`, { filePath })
  return result.messages.map((m) => m.message)
}

describe('chart libraries stay inside the adapters', () => {
  it.each(['@visx/shape', '@visx/scale', 'd3-scale', 'recharts', 'echarts', '@nivo/bar'])(
    'refuses %s in a page, a module and the rest of the UI kit',
    async (library) => {
      for (const filePath of [
        'src/app/(frontend)/example/page.tsx',
        'src/modules/news/ui/Example.tsx',
        'src/platform/ui/chart/Chart.tsx',
        'src/platform/ui/Example.tsx',
      ]) {
        const messages = await messagesFor(
          filePath,
          `import * as lib from '${library}'\nconsole.warn(lib)`,
        )
        expect(
          messages.some((m) => m.startsWith(MESSAGE)),
          `${library} in ${filePath}`,
        ).toBe(true)
      }
    },
  )

  it('allows them inside src/platform/ui/chart/adapters/', async () => {
    const messages = await messagesFor(
      'src/platform/ui/chart/adapters/visx/Example.tsx',
      "import * as lib from '@visx/shape'\nconsole.warn(lib)",
    )
    expect(messages.filter((m) => m.startsWith(MESSAGE))).toEqual([])
  })
})
