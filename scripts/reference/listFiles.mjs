/** The one recursive folder listing the reference generator uses (#1461). */
import fs from 'node:fs'
import path from 'node:path'

const walk = (folder, relative) =>
  fs.readdirSync(path.join(folder, relative), { withFileTypes: true }).flatMap((entry) => {
    const next = path.posix.join(relative, entry.name)
    return entry.isDirectory() ? walk(folder, next) : [next]
  })

/**
 * Every file under `folder`, as a `/`-separated path inside it, sorted. A missing folder gives
 * none, or an error that names it with `required` (a folder the pages are built from).
 */
export function listFiles(folder, { required = false } = {}) {
  if (!fs.existsSync(folder)) {
    if (required) throw new Error(`${folder} does not exist, so its files cannot be listed`)
    return []
  }
  return walk(folder, '').sort()
}
