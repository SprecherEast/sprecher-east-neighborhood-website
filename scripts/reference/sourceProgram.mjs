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

/** The files whose exported components the reference lists: the UI kit and rich text, without tests, stories and test helpers. */
export const componentSourceFiles = (fileNames) =>
  fileNames
    .filter((file) => COMPONENT_SOURCE.test(file) && !/\.(test|contract|stories)\.tsx$/.test(file))
    .filter((file) => !file.includes('/testing/'))
    .sort()
