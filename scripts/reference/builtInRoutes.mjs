/**
 * The routes Payload adds to each content type (#1461), grouped for the endpoints page: the live
 * ones by method and path with the types that have each, and the ones an earlier endpoint of the
 * same type takes first.
 */

/** The routes Payload adds to content types, one per method and path, with the types that have it. */
export function groupBuiltIn(contentTypes) {
  const found = new Map()
  for (const type of contentTypes) {
    for (const endpoint of type.allEndpoints) {
      if (endpoint.file !== 'payload' || (endpoint.replacedBy && !endpoint.replacedWhen)) continue
      const key = `${endpoint.method} ${endpoint.path}`
      const entry = found.get(key) ?? { method: endpoint.method, path: endpoint.path, types: [] }
      entry.types.push(type.slug)
      found.set(key, entry)
    }
  }
  const scopeOf = (types) =>
    ['collection', 'global']
      .map((kind) => {
        const all = contentTypes.filter((t) => t.kind === kind).map((t) => t.slug)
        const has = all.filter((slug) => types.includes(slug))
        const missing = all.filter((slug) => !types.includes(slug))
        if (has.length === 0) return ''
        if (has.length <= missing.length) return null
        return missing.length === 0
          ? `every ${kind}`
          : `every ${kind} except ${missing
              .sort()
              .map((slug) => `\`${slug}\``)
              .join(', ')}`
      })
      .filter((piece) => piece !== '')
      .reduce((all, piece) => (all === null || piece === null ? null : [...all, piece]), [])
      ?.join('; ') ?? ''
  return [...found.values()]
    .map((entry) => ({ ...entry, types: entry.types.sort(), scope: scopeOf(entry.types) }))
    .sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
}

/** Routes Payload adds that an earlier endpoint of the same type takes first. */
export const findReplaced = (contentTypes) =>
  contentTypes

    .flatMap((type) =>
      type.allEndpoints
        .filter((endpoint) => endpoint.file === 'payload' && endpoint.replacedBy)
        .map((endpoint) => ({
          slug: type.slug,
          method: endpoint.method,
          path: endpoint.path,
          by: {
            path: endpoint.replacedBy.path,
            name: endpoint.replacedBy.name,
            file: endpoint.replacedBy.file,
          },
          when: endpoint.replacedWhen ?? null,
        })),
    )
    .sort(
      (a, b) =>
        a.slug.localeCompare(b.slug) ||
        a.path.localeCompare(b.path) ||
        a.method.localeCompare(b.method),
    )
