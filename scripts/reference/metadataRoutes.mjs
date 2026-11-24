/**
 * The files Next.js turns into URLs by name (#1461): the metadata file conventions in the `app`
 * folder (`robots`, `sitemap`, `icon`, `apple-icon`, `favicon`, `manifest`, `opengraph-image`,
 * `twitter-image`, from the Next.js docs on file conventions) and everything in `public/`, which
 * is served from `/`. Pure functions over file lists; `collectAppFiles` and `publicEntries` read
 * the folders.
 */
import fs from 'node:fs'
import path from 'node:path'

const CONVENTIONS = [
  { name: 'robots', ext: /^(ts|js|txt)$/, url: () => '/robots.txt', topOnly: true },
  { name: 'sitemap', ext: /^(ts|js|xml)$/, url: (dir) => `${dir}/sitemap.xml` },
  { name: 'favicon', ext: /^ico$/, url: () => '/favicon.ico', topOnly: true },
  {
    name: 'manifest',
    ext: /^(ts|js|json|webmanifest)$/,
    url: () => '/manifest.webmanifest',
    topOnly: true,
  },
  { name: 'icon', ext: /^(ico|jpg|jpeg|png|svg|ts|js|tsx)$/, url: (dir) => `${dir}/icon` },
  { name: 'apple-icon', ext: /^(jpg|jpeg|png|ts|js|tsx)$/, url: (dir) => `${dir}/apple-icon` },
  {
    name: 'opengraph-image',
    ext: /^(jpg|jpeg|png|gif|ts|js|tsx)$/,
    url: (dir) => `${dir}/opengraph-image`,
  },
  {
    name: 'twitter-image',
    ext: /^(jpg|jpeg|png|gif|ts|js|tsx)$/,
    url: (dir) => `${dir}/twitter-image`,
  },
]
// A call to Payload, or an import from a module's server code, which reads its content
const READS_CONTENT = /\bgetPayload\b|from '@\/modules\/[^']+\/server'/
const CODE_EXTENSIONS = /^(ts|js|tsx)$/

const isGroup = (segment) => /^\(.*\)$/.test(segment)

/**
 * The URL rows for a list of files under `src/app` (paths relative to it). A route group's name
 * is not part of the URL. `generated` is true when code makes the response.
 */
export function describeMetadataFiles(files) {
  return files
    .flatMap((file) => {
      const segments = file.split('/')
      const base = segments.pop()
      const [stem, ...rest] = base.split('.')
      const ext = rest.join('.')
      const convention = CONVENTIONS.find((c) => c.name === stem && c.ext.test(ext))
      if (!convention || (convention.topOnly && segments.length > 0)) return []
      const dir = segments
        .filter((segment) => !isGroup(segment))
        .map((s) => `/${s}`)
        .join('')
      return [
        { url: convention.url(dir), file: `src/app/${file}`, generated: CODE_EXTENSIONS.test(ext) },
      ]
    })
    .sort((a, b) => a.url.localeCompare(b.url) || a.file.localeCompare(b.file))
}

const walk = (folder, relative = '') =>
  fs.readdirSync(path.join(folder, relative), { withFileTypes: true }).flatMap((entry) => {
    const next = path.posix.join(relative, entry.name)
    return entry.isDirectory() ? walk(folder, next) : [next]
  })

/** Metadata-convention files under `src/app`, with whether each one reads content. */
export function collectAppFiles(root) {
  const appRoot = path.join(root, 'src/app')
  return describeMetadataFiles(walk(appRoot)).map((row) => ({
    ...row,
    readsContent:
      row.generated && READS_CONTENT.test(fs.readFileSync(path.join(root, row.file), 'utf8')),
  }))
}

/** The top-level entries of `public/`: each is served at its own name, a folder with what is in it. */
export function publicEntries(root) {
  const folder = path.join(root, 'public')
  if (!fs.existsSync(folder)) return []
  return fs
    .readdirSync(folder, { withFileTypes: true })
    .map((entry) => (entry.isDirectory() ? `/${entry.name}/…` : `/${entry.name}`))
    .sort()
}
