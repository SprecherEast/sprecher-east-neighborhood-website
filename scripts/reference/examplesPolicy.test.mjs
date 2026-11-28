import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { readExamples } from './examplesReader.mjs'
import { safeKitFilesIn } from './kitFiles.mjs'

// The policy the generator and `examples.test.tsx` both read an examples file with
const safe = safeKitFilesIn(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..'))
const policy = { isKitFile: (file) => safe.has(file) }
const text = (importLine) =>
  `import { defineExample } from '@/platform/ui/example'\n${importLine}\nexport const A = defineExample({ purpose: 'x', render: () => null })\n`

describe('the policy an examples file is read with, on this repository', () => {
  it('refuses a relative import of a component beside it that is off the safe list, in either folder', () => {
    for (const [file, line] of [
      ['src/platform/richtext/RichText.examples.tsx', "import { RichText } from './RichText'"],
      [
        'src/platform/richtext/RichText.examples.tsx',
        "import { FigureBlock } from './FigureBlock'",
      ],
      ['src/platform/ui/Text.examples.tsx', "import { Media } from './Media'"],
      ['src/platform/ui/Text.examples.tsx', "import { AdminBar } from './AdminBar.client'"],
      ['src/platform/ui/Text.examples.tsx', "import { Nothing } from './Nonexistent'"],
    ]) {
      expect(() => readExamples(text(line), file, policy), `${file}: ${line}`).toThrow(
        /imports .*; an examples file may import only/,
      )
    }
  })

  it('accepts one that is on it', () => {
    expect(() =>
      readExamples(
        text("import { Button } from './Button'"),
        'src/platform/ui/Text.examples.tsx',
        policy,
      ),
    ).not.toThrow()
  })
})
