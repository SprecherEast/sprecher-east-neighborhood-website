/**
 * Loads everything the scan needs that costs something to read (#1462): the repository's files,
 * and the facts of the loaded Payload config and the compiler that the generated reference is made
 * from. It is the same load `npm run docs:generate` does, so the graph and the reference describe
 * one reading of the code. Run through `tsx`, which resolves the `@payload-config` alias.
 */
import { describeComponents, findUsers } from '../reference/components.mjs'
import { loadFacts } from '../reference/loadFacts.mjs'
import { componentSourceFiles, createSourceProgram } from '../reference/sourceProgram.mjs'
import { readRepository } from './reader.mjs'

/** The inputs of `scanGraph` for the repository at `root`. */
export async function loadInputs(root) {
  const repository = readRepository(root)
  const source = createSourceProgram(root)
  const components = describeComponents(
    source.program,
    root,
    componentSourceFiles(source.fileNames),
  )
  const componentUsers = findUsers(source.program, root, components)
  const facts = await loadFacts({ root, program: source.program })
  return {
    ...repository,
    facts,
    components: components.map(({ symbol, ...rest }) => rest),
    componentUsers,
  }
}
