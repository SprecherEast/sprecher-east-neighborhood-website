/** What the tests of the examples reader share: a made-up kit of component files. */
import { readExamples as readWith } from './examplesReader.mjs'

// The made-up kit: `AdminBar.client` and `Media` are component files that are not safe (`kitFiles.mjs`
// drops them), and `chart/BarTrack` is one in another folder
const COMPONENTS = [
  'Thing',
  'Tabs.client',
  'Button',
  'AdminBar.client',
  'Media',
  'chart/BarTrack',
].map((name) => `src/platform/ui/${name}.tsx`)
// The kit files an example may import: the made-up kit's safe ones (`kitFiles.mjs` computes the real list)
const KIT_FILES = COMPONENTS.filter((f) => !/AdminBar|Media/.test(f))
export const readExamples = (text, file) =>
  readWith(text, file, {
    isKitFile: (f) => KIT_FILES.includes(f),
  })

export const FILE = 'src/platform/ui/Thing.examples.tsx'
export const CLIENT_FILE = 'src/platform/ui/Thing.examples.client.tsx'
export const IMPORTS = `import { defineExample } from './example'\nimport { Thing } from './Thing'\n`
export const ONE = `defineExample({ purpose: 'x', render: () => null })`
export const read = (body, file = FILE) => readExamples(`${IMPORTS}${body}`, file)
export const withBody = (body) => `export const A = defineExample({ purpose: 'x', ${body} })\n`
