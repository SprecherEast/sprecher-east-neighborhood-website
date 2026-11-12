const TYPE_PREFIX =
  /^(feat|fix|docs|chore|refactor|test|ci|perf|style|build|revert)(\([^)]*\))?!?:\s*/i

/**
 * An issue's title as neighbors read it: the type prefix developers add ("feat:", "fix(ui):") is
 * dropped and the first letter capitalized. A title that would be left empty is kept as it is.
 */
export function plainTitle(title: string): string {
  const rest = title.replace(TYPE_PREFIX, '').trim()
  if (rest === '' || rest === title) return title
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}
