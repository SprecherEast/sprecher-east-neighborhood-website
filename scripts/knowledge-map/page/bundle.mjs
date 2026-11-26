/**
 * Joins the page's modules into one script (#1463), so the page is a single file with nothing to
 * load. Each module becomes a function that returns what it exports; an `import { a } from './x.mjs'`
 * becomes a read from that function's result. Only the forms the page's modules use are accepted:
 * named imports from a sibling, `export const|function|class`. Anything else throws, so a form this
 * does not understand never ships silently. Modules must be given dependencies first.
 */

const IMPORT = /^import\s+\{([^}]*)\}\s+from\s+'\.\/([\w.-]+)'\s*;?\s*$/gm
const EXPORT = /^export\s+(const|let|function|class)\s+(\w+)/gm

/** `modules` is `[[fileName, source]]`, dependencies first; returns the script's text. */
export function bundle(modules) {
  const seen = new Set()
  const parts = modules.map(([file, source]) => {
    if (/^\s*import\s/m.test(source.replace(IMPORT, '')))
      throw new Error(`${file}: only named imports from a sibling module are supported`)
    if (/^\s*export\s+(default|\{|\*)/m.test(source))
      throw new Error(`${file}: only "export const|let|function|class" is supported`)
    const names = [...source.matchAll(EXPORT)].map((m) => m[2])
    const body = source
      .replace(IMPORT, (_all, list, from) => {
        if (!seen.has(from))
          throw new Error(`${file}: imports ${from}, which is not bundled before it`)
        return `const { ${list.trim().replace(/\s+as\s+/g, ': ')} } = __modules['${from}']`
      })
      .replace(EXPORT, '$1 $2')
    seen.add(file)
    return `__modules['${file}'] = (() => {\n${body}\nreturn { ${names.join(', ')} }\n})()`
  })
  return `'use strict'\nconst __modules = {}\n${parts.join('\n')}\n`
}
