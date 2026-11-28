/** The TypeScript program for `src/`, with the project's own compiler options. */
import path from 'node:path'
import ts from 'typescript'

/** `root` is the repository folder; `fileNames` are all the files the project's tsconfig names. */
export function createSourceProgram(root) {
  const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
  const srcRoot = `${root}/src/`
  return {
    program: ts.createProgram({
      rootNames: parsed.fileNames.filter((file) => file.startsWith(srcRoot)),
      options: { ...parsed.options, incremental: false },
    }),
    fileNames: parsed.fileNames,
  }
}

const COMPONENT_SOURCE = /\/src\/platform\/(ui|richtext)\/.*\.tsx$/
const NOT_A_COMPONENT = /\.(test|contract|stories|examples(\.client)?)\.tsx$/

/** Whether a file (an absolute path, or one under the repository) holds shared components: not a test, story, examples file or test helper. */
export const isComponentSourceFile = (file) =>
  COMPONENT_SOURCE.test(`/${file}`) && !NOT_A_COMPONENT.test(file) && !file.includes('/testing/')

/** The files whose exported components the reference lists: the UI kit and rich text, without tests, stories, examples and test helpers. */
export const componentSourceFiles = (fileNames) => fileNames.filter(isComponentSourceFile).sort()

const EXAMPLES_FILE = /\/src\/platform\/(ui|richtext)\/.*\.examples(\.client)?\.tsx$/

/** The examples files (#1532, server and client) of the kit and rich text, as paths under `root`, sorted. */
export const examplesSourceFiles = (fileNames, root) =>
  fileNames
    .filter((file) => EXAMPLES_FILE.test(file))
    .map((file) => path.relative(root, file).split(path.sep).join('/'))
    .sort()
