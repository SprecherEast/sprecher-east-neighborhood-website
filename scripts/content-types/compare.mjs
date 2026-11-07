/**
 * Compares the pages the generator makes with the ones on disk (#714). Both are Maps of file name
 * to text. `docs:check` fails on any difference and says how to fix it.
 */
export function compareFiles(expected, actual) {
  const changed = []
  const missing = []
  for (const [file, text] of expected) {
    if (!actual.has(file)) missing.push(file)
    else if (actual.get(file) !== text) changed.push(file)
  }
  const extra = [...actual.keys()].filter((file) => !expected.has(file))
  return { changed: changed.sort(), missing: missing.sort(), extra: extra.sort() }
}

/** The failure message, or an empty string when nothing differs. */
export function describeDifferences({ changed, missing, extra }, directory) {
  const lines = [
    ...changed.map((file) => `  changed: ${file}`),
    ...missing.map((file) => `  missing: ${file}`),
    ...extra.map((file) => `  no longer generated: ${file}`),
  ]
  if (lines.length === 0) return ''
  return [
    `${directory} is out of date with the code:`,
    ...lines,
    'Run `npm run docs:generate` and commit the result.',
  ].join('\n')
}
