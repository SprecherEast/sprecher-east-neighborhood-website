/**
 * Writes one reference page for every Payload collection and global (#714, decision 0019 §4), and
 * checks that the committed pages are current.
 *
 *   npm run docs:generate    write docs/reference/content-types/
 *   npm run docs:check       regenerate in memory and fail if anything differs from what is committed
 *
 * It loads the real config with `loadConfig` from the access-policy tests: no database, no server.
 * Run through `tsx`, which resolves the `@payload-config` alias from tsconfig.json and loads the
 * TypeScript config. The pure parts are in scripts/content-types/.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'

import { compareFiles, describeDifferences } from './content-types/compare.mjs'
import { describeContentType } from './content-types/describe.mjs'
import { pinEnvironment } from './content-types/environment.mjs'
import { createLocator } from './content-types/locate.mjs'
import { buildPages } from './content-types/render.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = 'docs/reference/content-types'

async function loadModels() {
  // Fixed, so the output never depends on the machine's environment (see environment.mjs)
  pinEnvironment()
  const { loadConfig } = await import('../src/platform/payload/testing/accessHarness.ts')
  const config = await loadConfig()
  const { locate, close } = createLocator(ROOT)
  try {
    const options = { locate, root: ROOT }
    return [
      ...config.collections.map((entry) => describeContentType(entry, 'collection', options)),
      ...config.globals.map((entry) => describeContentType(entry, 'global', options)),
    ]
  } finally {
    close()
  }
}

async function formatted(files) {
  const config = (await prettier.resolveConfig(path.join(ROOT, OUTPUT, 'README.md'))) ?? {}
  const out = new Map()
  for (const [file, text] of files) {
    // The Tailwind plugin only sorts class names; it does nothing to Markdown
    out.set(file, await prettier.format(text, { ...config, plugins: [], parser: 'markdown' }))
  }
  return out
}

function readCommitted(directory) {
  if (!fs.existsSync(directory)) return new Map()
  return new Map(
    fs
      .readdirSync(directory)
      .filter((file) => file.endsWith('.md'))
      .map((file) => [file, fs.readFileSync(path.join(directory, file), 'utf8')]),
  )
}

const started = Date.now()
const directory = path.join(ROOT, OUTPUT)
const pages = await formatted(buildPages(await loadModels()))
const seconds = ((Date.now() - started) / 1000).toFixed(1)

if (process.argv.includes('--check')) {
  const message = describeDifferences(compareFiles(pages, readCommitted(directory)), OUTPUT)
  if (message) {
    console.error(message)
    process.exit(1)
  }
  console.log(`${OUTPUT} is current (${pages.size} pages, ${seconds} s).`)
} else {
  fs.mkdirSync(directory, { recursive: true })
  for (const file of readCommitted(directory).keys()) {
    if (!pages.has(file)) fs.rmSync(path.join(directory, file))
  }
  for (const [file, text] of pages) fs.writeFileSync(path.join(directory, file), text)
  console.log(`Wrote ${pages.size} pages to ${OUTPUT} (${seconds} s).`)
}
