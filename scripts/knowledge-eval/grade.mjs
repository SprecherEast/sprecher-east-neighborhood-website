// Grading for the knowledge eval (#715). A mechanical first pass: a person still reads the answers.

/** Lowercase, no asterisks or double quotes, spaces collapsed; line breaks stay for the regexes. */
export function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[*"]/g, '')
    .replace(/[ \t]+/g, ' ')
}

const isPattern = (alt) => alt.length > 2 && alt.startsWith('/') && alt.endsWith('/')

function found(normalized, alternative) {
  if (isPattern(alternative)) return new RegExp(alternative.slice(1, -1), 'i').test(normalized)
  return normalized.includes(normalize(alternative))
}

/**
 * Check an answer against a key: a list of facts, each a list of alternative spellings (a plain
 * string, or `/regex/`). Full when every fact is found, half when at least half are, else none.
 */
export function gradeAnswer(answer, key) {
  const normalized = normalize(answer ?? '')
  const missing = key
    .filter((alts) => !alts.some((alt) => found(normalized, alt)))
    .map((alts) => alts[0])
  const score = missing.length === 0 ? 'full' : missing.length * 2 <= key.length ? 'half' : 'none'
  return { score: answer ? score : 'none', missing }
}

const ERROR_LINE = /error TS/

function commandPassed(spec, result) {
  if (result.code === 0) return true
  const tolerate = spec.tolerate ?? []
  const errors = (result.errors ?? []).filter((line) => ERROR_LINE.test(line))
  if (errors.length === 0) return false
  return errors.every((line) => tolerate.some((part) => line.includes(part)))
}

/**
 * Grade a change from what the runner recorded after the session: the exit code of each listed
 * command, and the files that changed. Passes only if every command passes (type errors the task
 * names as already there are tolerated) and every `mustChange` pattern matches a changed file.
 */
export function gradeChange(spec, { commands, changedFiles }) {
  const failures = []
  for (const command of spec.commands) {
    const result = commands.find((c) => c.cmd === command.cmd)
    if (!result) failures.push(`command not run: ${command.cmd}`)
    else if (!commandPassed(command, result)) failures.push(`command failed: ${command.cmd}`)
  }
  for (const pattern of spec.mustChange) {
    const regex = new RegExp(pattern)
    if (!changedFiles.some((file) => regex.test(file)))
      failures.push(`no changed file matches ${pattern}`)
  }
  return { pass: failures.length === 0, failures }
}
