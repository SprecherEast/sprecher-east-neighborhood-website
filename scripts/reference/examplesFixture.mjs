/** What the tests of the examples reader share: a made-up kit with one folder and three component files. */
import { readExamples as readWith } from './examplesReader.mjs'

// A relative import may reach only a component file of this made-up kit
const COMPONENTS = ['Thing', 'Tabs.client', 'Button'].map((name) => `src/platform/ui/${name}.tsx`)
// The kit files an example may import: the made-up kit's safe ones (`kitFiles.mjs` computes the real list)
const KIT_FILES = [...COMPONENTS, 'src/platform/ui/chart/BarTrack.tsx']
export const readExamples = (text, file) =>
  readWith(text, file, {
    isComponentFile: (f) => COMPONENTS.includes(f),
    isKitFile: (f) => KIT_FILES.includes(f),
  })

export const FILE = 'src/platform/ui/Thing.examples.tsx'
export const CLIENT_FILE = 'src/platform/ui/Thing.examples.client.tsx'
export const IMPORTS = `import { defineExample } from './example'\nimport { Thing } from './Thing'\n`
export const ONE = `defineExample({ purpose: 'x', render: () => null })`
export const read = (body, file = FILE) => readExamples(`${IMPORTS}${body}`, file)
export const withBody = (body) => `export const A = defineExample({ purpose: 'x', ${body} })\n`
