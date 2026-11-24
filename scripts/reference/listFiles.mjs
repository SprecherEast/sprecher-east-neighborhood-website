/** The one recursive folder listing the reference generator uses (#1461). */
import fs from 'node:fs'
import path from 'node:path'

/** Every file under `folder`, as a `/`-separated path inside it, sorted; none if it is missing. */
export function listFiles(folder, relative = '') {
  const here = path.join(folder, relative)
  if (!fs.existsSync(here)) return []
  return fs
    .readdirSync(here, { withFileTypes: true })
    .flatMap((entry) => {
      const next = path.posix.join(relative, entry.name)
      return entry.isDirectory() ? listFiles(folder, next) : [next]
    })
    .sort()
}
