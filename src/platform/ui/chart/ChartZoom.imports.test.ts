import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

/*
 * What the browser downloads for a chart (#681): `ChartZoom` is the only client code in the chart,
 * so everything it imports, however deep, is sent to the browser. Chart libraries, zod and the
 * chart's spec rules are server code and must never be on that path.
 */
const SRC = join(__dirname, '..', '..', '..')
const IMPORT = /(?:import|export)[^'"`;]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g

function resolveLocal(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@/')
    ? join(SRC, specifier.slice(2))
    : resolve(dirname(from), specifier)
  for (const candidate of [`${base}.tsx`, `${base}.ts`, join(base, 'index.ts'), base]) {
    if (existsSync(candidate) && /\.(tsx?)$/.test(candidate)) return candidate
  }
  return null
}

/** Every file and every package reachable from an entry file */
function reachable(entry: string) {
  const files = new Set<string>()
  const packages = new Set<string>()
  const visit = (file: string) => {
    if (files.has(file)) return
    files.add(file)
    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const specifier = match[1] ?? match[2]
      if (!specifier || /^import type/.test(match[0])) continue
      const local = specifier.startsWith('.') || specifier.startsWith('@/')
      const next = local ? resolveLocal(file, specifier) : null
      if (next) visit(next)
      else if (!local) packages.add(specifier)
    }
  }
  visit(entry)
  return { files: [...files].map((f) => f.slice(SRC.length + 1)), packages: [...packages] }
}

describe('ChartZoom sends no chart code to the browser', () => {
  const { files, packages } = reachable(join(SRC, 'platform/ui/chart/ChartZoom.client.tsx'))

  it('reaches no chart library, no zod and no visx', () => {
    expect(packages.filter((name) => /^(@visx|d3|recharts|echarts|@nivo|zod)/.test(name))).toEqual(
      [],
    )
  })

  it('reaches neither the chart’s spec rules nor an adapter', () => {
    expect(
      files.filter((file) => /lib\/chart\/|chart\/adapters\/|chart\/Chart\.tsx$/.test(file)),
    ).toEqual([])
  })

  it('does reach the dialog and the button (so the guard walks the real graph)', () => {
    expect(files).toEqual(
      expect.arrayContaining([
        'platform/ui/chart/chartDrawing.ts',
        'platform/ui/Dialog.client.tsx',
        'platform/ui/Button.tsx',
      ]),
    )
  })
})
