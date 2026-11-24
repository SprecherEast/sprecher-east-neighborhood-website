/**
 * Which plugin makes a content type that no source file of ours defines (#1461): the plugin
 * packages the config imports are searched for the type's slug where they set it, as a default
 * (`slug: options?.slug || 'forms'`) or a plain `slug: 'forms'`. Read from the installed package,
 * so a plugin that changes its slug is noticed.
 */
import fs from 'node:fs'
import path from 'node:path'

import { listFiles } from './listFiles.mjs'

const escaped = (slug) => slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The first of `plugins` (package names) whose code sets `slug` as a content type slug. */
export function pluginDefining(root, slug, plugins) {
  const setsSlug = new RegExp(`\\bslug:[^,\\n]*['"]${escaped(slug)}['"]`)
  return (
    plugins.find((plugin) => {
      const dist = path.join(root, 'node_modules', plugin, 'dist')
      return listFiles(dist)
        .filter((file) => /\.js$/.test(file) && !file.endsWith('.test.js'))
        .some((file) => setsSlug.test(fs.readFileSync(path.join(dist, file), 'utf8')))
    }) ?? ''
  )
}
