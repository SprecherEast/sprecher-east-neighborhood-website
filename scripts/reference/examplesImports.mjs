/**
 * What an examples file may import (#1532): an allow-list, refused by default, so widening it is a
 * reviewed change to this file. Each specifier is judged here, whatever its form.
 */
import path from 'node:path'
import ts from 'typescript'

// What an example may import besides the safe kit files: React and the icons
export const PACKAGES_ALLOWED = new Set(['react', 'lucide-react'])
const KIT_PREFIX = '@/platform/ui/'
// The one format file; `./example` is it only from a file in the kit's own folder
export const FORMAT_FILE = 'src/platform/ui/example'
export const FORMAT = new Set(['./example', '@/platform/ui/example'])
// One step of a path: a name with dots inside (`Tabs.client`), never empty, `.`, `..` or hidden
const PATH_STEP = /^\w[\w-]*(\.\w[\w-]*)*$/

/**
 * Whether a specifier names a safe kit file: `@/platform/ui/` and then plain names, so a `.` or
 * `..` step (or an empty or escaped one) can never walk out of the kit. `isKitFile` is given the
 * repository path (`src/platform/ui/chart/BarTrack.tsx`) and says whether it is on the safe list.
 */
export function kitAllowed(specifier, isKitFile) {
  if (!specifier.startsWith(KIT_PREFIX)) return false
  const steps = specifier.slice(KIT_PREFIX.length).split('/')
  return (
    steps.every((step) => PATH_STEP.test(step)) &&
    isKitFile(`src/platform/ui/${steps.join('/')}.tsx`)
  )
}

/**
 * Whether a relative import reaches a file in the same folder that is on the safe list
 * (`isKitFile`), or the format's own file. The safe list is the only list: an examples file sits
 * beside its component, so a relative path is as much a way to `AdminBar` or `RichText` as an
 * alias is, in the kit's folder and in rich text's alike.
 */
export function relativeAllowed(specifier, file, isKitFile) {
  const folder = path.posix.dirname(file)
  const target = path.posix.normalize(path.posix.join(folder, specifier))
  if (path.posix.dirname(target) !== folder) return false
  return target === FORMAT_FILE || isKitFile(`${target}.tsx`)
}

/** Whether an import may be there at all: a package, the format file or a safe kit file, by alias or relative path. */
export function importAllowed(specifier, file, isKitFile) {
  if (PACKAGES_ALLOWED.has(specifier)) return true
  if (specifier === `@/${FORMAT_FILE.slice(4)}`) return true
  if (kitAllowed(specifier, isKitFile)) return true
  return specifier.startsWith('./') && relativeAllowed(specifier, file, isKitFile)
}

/**
 * Judges one import or export statement: fails on a specifier that is not allowed, and says whether
 * the statement imports `defineExample` (which must come from the format file).
 */
export function checkImport(statement, file, isKitFile, fail) {
  const specifier =
    (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
    statement.moduleSpecifier?.text
  if (specifier === false || specifier === undefined) return false
  if (!importAllowed(specifier, file, isKitFile)) {
    fail(
      `imports ${specifier}; an examples file may import only react, lucide-react, the kit components on the safe list (@/platform/ui/<name>) and the component files beside it`,
    )
  }
  const named = ts.isImportDeclaration(statement) && statement.importClause?.namedBindings
  if (!named || !ts.isNamedImports(named)) return false
  if (!named.elements.some((e) => e.name.text === 'defineExample')) return false
  if (!FORMAT.has(specifier)) fail('defineExample comes from ./example')
  return true
}
