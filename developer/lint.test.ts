import fs from 'node:fs'
import path from 'node:path'

import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(__dirname, '..')
const eslint = new ESLint({ cwd: ROOT })

describe('ESLint and the developer pages (#1530)', () => {
  // `npm run developer:build` leaves ~6,000 minified files here; flat config's `out/**` and `.next/**`
  // match only at the repository root, so the build folders are named
  it.each(['developer/out/_next/static/chunks/x.js', 'developer/.next/server/x.js'])(
    'does not lint the build output %s',
    async (file) => {
      expect(await eslint.isPathIgnored(path.join(ROOT, file))).toBe(true)
    },
  )

  it('lints the pages themselves', async () => {
    expect(await eslint.isPathIgnored(path.join(ROOT, 'developer/app/page.tsx'))).toBe(false)
  })

  it('stops the site importing the developer pages', async () => {
    const [result] = await eslint.lintText(
      "import Page from '../../developer/app/page'\nexport default Page\n",
      {
        filePath: path.join(ROOT, 'src/app/(frontend)/tools/page.tsx'),
      },
    )
    expect(result.messages.map((m) => m.message).join('\n')).toContain(
      'never imports the developer pages',
    )
  })

  it('has the doc say what the config does', () => {
    const doc = fs.readFileSync(path.join(ROOT, 'ops/developer-site.md'), 'utf8')
    expect(doc).toContain('`developer/out/**` and `developer/.next/**`')
  })
})
