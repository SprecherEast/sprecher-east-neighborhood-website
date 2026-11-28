import { build, type Plugin } from 'esbuild'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

const ROOT = join(import.meta.dirname, '../../../..')
const FLIGHT = 'next/dist/compiled/react-server-dom-webpack/server.node'
const USE_CLIENT = /^\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*(['"])use client\1/
const ref = (id: string, name: string) =>
  `registerClientReference(function () { throw new Error('a client component ran on the server') }, ${JSON.stringify(id)}, ${JSON.stringify(name)})`

/**
 * Turns every module that starts with 'use client' into client references, as the framework's
 * bundler does for a server page: the server renders around them and passes them props, and a
 * function in those props is refused, which is what this test is for.
 */
const clientReferences: Plugin = {
  name: 'client-references',
  setup(bundler) {
    bundler.onLoad({ filter: /\.(m?js|cjs|jsx|tsx?)$/ }, async ({ path }) => {
      const text = readFileSync(path, 'utf8')
      if (!USE_CLIENT.test(text)) return null
      const probe = await build({
        entryPoints: [path],
        bundle: true,
        write: false,
        metafile: true,
        format: 'esm',
        packages: 'external',
        logLevel: 'silent',
        jsx: 'automatic',
        loader: { '.js': 'jsx' },
        alias: { '@': join(ROOT, 'src') },
      })
      const names = Object.values(probe.metafile.outputs)[0]?.exports ?? []
      const id = relative(ROOT, path)
      const commonJs = /\bmodule\.exports\b|exports\.default|defineProperty\(exports/.test(text)
      if (commonJs && !/^\s*export /m.test(text)) {
        return {
          loader: 'js',
          contents: [
            `const { registerClientReference } = require(${JSON.stringify(FLIGHT)})`,
            `module.exports = ${ref(id, 'default')}`,
            'module.exports.default = module.exports',
            ...names
              .filter((name) => name !== 'default')
              .map((name) => `module.exports[${JSON.stringify(name)}] = ${ref(id, name)}`),
          ].join('\n'),
        }
      }
      return {
        loader: 'js',
        contents: [
          `import { registerClientReference } from ${JSON.stringify(FLIGHT)}`,
          ...names.map((name) =>
            name === 'default'
              ? `export default ${ref(id, name)}`
              : `export const ${name} = ${ref(id, name)}`,
          ),
        ].join('\n'),
      }
    })
  },
}

/** The program that draws each example with the framework's server renderer and reports what failed. */
const runner = (files: string[]) => `
import { PassThrough } from 'node:stream'
import { renderToPipeableStream } from ${JSON.stringify(FLIGHT)}
import { defaultSettings } from '@/platform/ui/example'
import { settingVariations } from '@/platform/ui/testing/exampleSettings'
${files.map((file, i) => `import * as m${i} from ${JSON.stringify(join(ROOT, file))}`).join('\n')}
const modules = { ${files.map((file, i) => `${JSON.stringify(file)}: m${i}`).join(', ')} }
const references = new Proxy({}, { get: (_, id) => new Proxy({}, { get: (_, name) => ({ id, name, chunks: [] }) }) })

function draw(element) {
  return new Promise((resolve) => {
    const problems = []
    const log = console.error
    console.error = (...args) => problems.push(String(args[0]).split('\\n')[0])
    const out = new PassThrough()
    out.resume()
    out.on('end', () => {
      console.error = log
      resolve(problems[0] ?? null)
    })
    renderToPipeableStream(element, references, {
      onError: (error) => {
        problems.push(String(error.message).split('\\n')[0])
      },
    }).pipe(out)
  })
}

;(async () => {
  const results = []
  for (const [file, module] of Object.entries(modules)) {
    for (const [name, example] of Object.entries(module)) {
      const starts = [defaultSettings(example.settings), ...settingVariations(example.settings)]
      for (const values of starts) results.push({ file, name, problem: await draw(example.render(values)) })
    }
  }
  console.log(JSON.stringify(results))
})()
`

/**
 * Draws every example of the given files on the server, the way a server page does (the framework's
 * own renderer, with every client module as a client reference), and returns each problem:
 * `{ file, name, problem }`, one for each way an example failed. No problem means it can be drawn.
 */
export async function renderOnServer(files: string[]) {
  const folder = mkdtempSync(join(tmpdir(), 'showcase-server-'))
  try {
    const outfile = join(folder, 'run.cjs')
    await build({
      stdin: { contents: runner(files), resolveDir: ROOT, loader: 'js' },
      bundle: true,
      outfile,
      platform: 'node',
      format: 'cjs',
      conditions: ['react-server'],
      alias: { '@': join(ROOT, 'src') },
      plugins: [clientReferences],
      jsx: 'automatic',
      loader: { '.scss': 'empty', '.css': 'empty' },
      logLevel: 'silent',
    })
    const run = spawnSync(process.execPath, ['--conditions', 'react-server', outfile], {
      encoding: 'utf8',
      timeout: 120_000,
    })
    if (run.status !== 0) throw new Error(`the server render stopped: ${run.stderr.slice(0, 800)}`)
    const results = JSON.parse(run.stdout.trim().split('\n').pop() ?? '[]') as {
      file: string
      name: string
      problem: string | null
    }[]
    return results.filter((result) => result.problem !== null)
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
}
