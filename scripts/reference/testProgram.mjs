/**
 * A small TypeScript project on disk for the tests of the source facts: write files, then build
 * a program over them with the compiler options the site uses (the `@/` alias included).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import ts from 'typescript'

export function createFixture(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  const files = []
  return {
    root,
    write(file, text) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
      fs.writeFileSync(path.join(root, file), text)
      files.push(file)
    },
    load: () =>
      ts.createProgram({
        rootNames: files.map((file) => path.join(root, file)),
        options: {
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          jsx: ts.JsxEmit.Preserve,
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          moduleResolution: ts.ModuleResolutionKind.Bundler,
          baseUrl: root,
          paths: { '@/*': ['src/*'] },
        },
      }),
    cleanup: () => fs.rmSync(root, { recursive: true, force: true }),
  }
}
