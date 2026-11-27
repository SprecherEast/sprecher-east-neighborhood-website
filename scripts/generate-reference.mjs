/**
 * Writes the generated reference (decision 0019 §4) and checks that the committed pages are current.
 *
 *   npm run docs:generate    write docs/reference/
 *   npm run docs:check       regenerate in memory and fail if anything differs from what is committed
 *
 * Content types (#714): loads the real Payload config with `loadConfig` from the access-policy
 * tests, no database and no server; the pure parts are in scripts/content-types/. Screens and
 * shared components (#718): the TypeScript compiler API reads src/; the pure parts are in
 * scripts/reference/. UI element coverage (#495): read from the element tables in docs/ui/.
 * Endpoints, AI agent tools, and jobs and schedules (#1461): read from the same loaded config, the
 * MCP plugin options, the route files, the source (which collections a tool or task reaches) and
 * the timed GitHub workflows; the owner of each content type is the module that defines it.
 *
 * Run through `tsx`, which resolves the `@payload-config` alias from tsconfig.json and loads the
 * TypeScript config.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import prettier from 'prettier'

import { compareFiles, describeDifferences } from './content-types/compare.mjs'
import { PAGE_LINE_LIMIT, buildPages } from './content-types/render.mjs'
import {
  ELEMENT_FILES,
  buildCoverage,
  parseElementRows,
  renderCoverage,
} from './reference/coverage.mjs'
import { COMPONENT_GROUPS } from './reference/componentGroups.mjs'
import {
  describeComponents,
  findUsers,
  groupComponents,
  renderComponentIndex,
  renderComponentPage,
} from './reference/components.mjs'
import { renderApi } from './reference/endpointsPage.mjs'
import { renderJobs } from './reference/jobsPage.mjs'
import { listFiles } from './reference/listFiles.mjs'
import { loadFacts } from './reference/loadFacts.mjs'
import { renderMcp } from './reference/mcpTools.mjs'
import { collectRoutes, renderRoutes } from './reference/routes.mjs'
import { buildShowcaseIndex, renderShowcaseIndex } from './reference/showcase.mjs'
import {
  componentSourceFiles,
  createSourceProgram,
  examplesSourceFiles,
} from './reference/sourceProgram.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = 'docs/reference'
/** The showcase index (#1532): data for the developer site's showcase pages and its coverage check */
const SHOWCASE_INDEX = 'showcase-index.json'

function buildComponentPages({ program, fileNames }) {
  const files = componentSourceFiles(fileNames)
  const components = describeComponents(program, ROOT, files)
  const users = findUsers(program, ROOT, components)
  const groups = groupComponents(COMPONENT_GROUPS, components)
  const index = buildShowcaseIndex({
    groups,
    users,
    readFile: (file) =>
      fs.existsSync(path.join(ROOT, file))
        ? fs.readFileSync(path.join(ROOT, file), 'utf8')
        : undefined,
    exampleFiles: examplesSourceFiles(fileNames, ROOT),
  })
  const pages = new Map([
    ['components/README.md', renderComponentIndex(groups, index.coverage)],
    [SHOWCASE_INDEX, renderShowcaseIndex(index)],
  ])
  for (const group of groups) {
    pages.set(`components/${group.slug}.md`, renderComponentPage(group, group.components, users))
  }
  return pages
}

/** The element-to-component coverage page (#495), made from the element tables in docs/ui/. */
function buildCoveragePage() {
  const rows = ELEMENT_FILES.flatMap((file) =>
    parseElementRows(fs.readFileSync(path.join(ROOT, file), 'utf8')),
  )
  return renderCoverage(buildCoverage(rows))
}

async function formatted(files) {
  const config = (await prettier.resolveConfig(path.join(ROOT, OUTPUT, 'routes.md'))) ?? {}
  const out = new Map()
  for (const [file, text] of files) {
    // The Tailwind plugin only sorts class names; it does nothing to Markdown or JSON
    const json = file.endsWith('.json')
    const page = await prettier.format(text, {
      ...config,
      plugins: [],
      parser: json ? 'json' : 'markdown',
    })
    const lines = page.trimEnd().split('\n').length
    // A page is read by people and stays short; the showcase index is data and grows with the kit
    if (!json && lines > PAGE_LINE_LIMIT) {
      throw new Error(
        `${file} has ${lines} lines, over the limit of ${PAGE_LINE_LIMIT}: split its group`,
      )
    }
    out.set(file, page)
  }
  return out
}

/** Every Markdown file and the showcase index under the folder, keyed by its path inside it. */
const readCommitted = (directory) =>
  new Map(
    listFiles(directory)
      .filter((file) => file.endsWith('.md') || file === SHOWCASE_INDEX)
      .map((file) => [file, fs.readFileSync(path.join(directory, file), 'utf8')]),
  )

const started = Date.now()
const directory = path.join(ROOT, OUTPUT)
// One program for the components and the facts. The component pages are built first: a type
// checker orders the members of a union by when it first met them, so this order keeps their
// prop types as they were
const source = createSourceProgram(ROOT)
const componentPages = buildComponentPages(source)
const facts = await loadFacts({ root: ROOT, program: source.program })
const contentTypes = new Map(
  [...buildPages(facts.models)].map(([file, text]) => [`content-types/${file}`, text]),
)
const pages = await formatted(
  new Map([
    ...contentTypes,
    ['routes.md', renderRoutes(collectRoutes(ROOT))],
    ['ui-coverage.md', buildCoveragePage()],
    ['endpoints.md', renderApi(facts.api)],
    ['mcp-tools.md', renderMcp(facts.mcp)],
    [
      'jobs.md',
      renderJobs(facts.scheduled.jobs, facts.scheduled.workflows, facts.scheduled.extras),
    ],
    ...componentPages,
  ]),
)
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
  for (const [file, text] of pages) {
    fs.mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
    fs.writeFileSync(path.join(directory, file), text)
  }
  console.log(`Wrote ${pages.size} pages to ${OUTPUT} (${seconds} s).`)
}
