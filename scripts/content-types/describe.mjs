/**
 * Turns a loaded Payload config into plain data about each content type (#714): its fields, who
 * may do what, its hooks, its endpoints, its drafts. Pure functions with no file or database
 * access, so they are tested with small fixtures. `render.mjs` turns this data into Markdown.
 */
import { describeAccess, describeEndpoints, describeHooks, noFiles } from './callbacks.mjs'
import { describeFields } from './fields.mjs'
import { describeSettings, describeVersions } from './settings.mjs'

/** Everything a page needs about one collection or global. */
export function describeContentType(entry, kind, { locate = noFiles, root = '' } = {}) {
  const label = entry.labels?.plural ?? entry.labels?.singular ?? entry.label
  const description = entry.admin?.description
  return {
    slug: entry.slug,
    kind,
    title: typeof label === 'string' ? label : entry.slug,
    purpose: typeof description === 'string' ? description : '',
    versions: describeVersions(entry.versions),
    access: describeAccess(entry.access, locate),
    hooks: describeHooks(entry.hooks, locate),
    endpoints: describeEndpoints(entry.endpoints, locate),
    fields: describeFields(entry.fields ?? [], { locate }),
    auth: describeSettings(entry.auth, { root }),
    upload: describeSettings(entry.upload, { root }),
  }
}
