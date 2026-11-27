/**
 * The showcase index (#1532, epic #1528): one JSON file with, for every shared component, what the
 * showcase pages, the landing page and the coverage check need: its group, description, props,
 * variants, where it is used and its examples. The examples are read, never copied
 * (`examplesReader.mjs`): the source shown for an example is the text of its own `render` function
 * and the helpers it uses.
 */
import path from 'node:path'

import { generatedNotice } from '../content-types/render.mjs'
import { examplesFilesFor, readExamples } from './examplesReader.mjs'

/** The examples of each component file: read from its server and client examples files. */
function readFileExamples({ all, readFile, isComponentFile }) {
  const byFile = new Map()
  for (const file of new Set(all.map(({ component }) => component.file))) {
    const names = all
      .filter(({ component }) => component.file === file)
      .map(({ component }) => component.name)
    const stem = path.posix.basename(file).replace(/(\.client)?\.tsx$/, '')
    const primary = names.includes(stem) ? stem : names[0]
    const items = []
    for (const { file: examplesFile } of examplesFilesFor(file)) {
      const text = readFile(examplesFile)
      if (text === undefined) continue
      for (const example of readExamples(text, examplesFile, { isComponentFile })) {
        const named = [example.of ?? primary].flat()
        for (const name of named) {
          if (!names.includes(name)) {
            throw new Error(
              `${examplesFile}: ${example.name} names ${name}, which ${path.posix.basename(file)} does not export`,
            )
          }
        }
        const twin = items.find(({ example: other }) => other.anchor === example.anchor)
        if (twin) {
          throw new Error(
            `${examplesFile}: ${example.name} has the same link name as ${twin.example.name} in ${twin.example.file}`,
          )
        }
        items.push({ example, named })
      }
    }
    byFile.set(file, items)
  }
  return byFile
}

/**
 * The index: `groups` are the reference's groups with their described components, `users` maps a
 * component name to the files that import it, `readFile` gives a file's text or `undefined`, and
 * `exampleFiles` lists every examples file in the kit, so one beside no component fails.
 */
export function buildShowcaseIndex({ groups, users, readFile, exampleFiles }) {
  const all = groups.flatMap((group) => group.components.map((component) => ({ group, component })))
  const componentFiles = new Set(all.map(({ component }) => component.file))
  const claimed = new Set(
    [...componentFiles].flatMap((file) => examplesFilesFor(file).map((f) => f.file)),
  )
  for (const file of exampleFiles) {
    if (!claimed.has(file)) throw new Error(`${file} is beside no component file`)
  }
  const byFile = readFileExamples({
    all,
    readFile,
    isComponentFile: (file) => componentFiles.has(file),
  })

  const components = all.map(({ group, component }) => {
    const items = byFile.get(component.file).filter(({ named }) => named.includes(component.name))
    const list = items.map(({ example }) => example)
    return {
      name: component.name,
      group: group.slug,
      groupTitle: group.title,
      file: component.file,
      description: component.description,
      props: component.props,
      inheritedProps: component.inherited,
      parts: component.parts,
      usedBy: {
        count: (users.get(component.name) ?? []).length,
        files: users.get(component.name) ?? [],
      },
      examples:
        list.length > 0 ? { files: [...new Set(list.map((e) => e.file))], items: list } : null,
    }
  })
  const missing = components.filter((c) => c.examples === null).map((c) => c.name)
  return {
    generated: generatedNotice(
      'the TypeScript types and imports under `src/` and the `*.examples.tsx` and `*.examples.client.tsx` files beside the components',
    ),
    coverage: {
      total: components.length,
      withExamples: components.length - missing.length,
      missing,
    },
    components,
  }
}

/** The index as the text of `docs/reference/showcase-index.json` (the generator formats it). */
export const renderShowcaseIndex = (index) => `${JSON.stringify(index, null, 2)}\n`
