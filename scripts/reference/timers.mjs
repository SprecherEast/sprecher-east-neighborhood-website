/**
 * The timers set outside the Payload config (#1461), read from the files that set them: GitHub
 * workflows with a `schedule`, the cron line a server script installs, the intelligence
 * pipeline's schedule setting and Dependabot's update schedules. Pure functions over file text.
 */
import yaml from 'js-yaml'

/** The GitHub workflows that have a `schedule` trigger: file, name, cron lines and job names. */
export function parseTimedWorkflows(files) {
  const found = []
  for (const { file, text } of files) {
    const doc = yaml.load(text)
    const schedule = doc?.on?.schedule
    if (!Array.isArray(schedule) || schedule.length === 0) continue
    found.push({
      file,
      name: doc.name ?? file.split('/').pop(),
      crons: schedule.map((entry) => entry.cron).filter(Boolean),
      jobs: Object.entries(doc.jobs ?? {}).map(([id, job]) => job?.name ?? id),
    })
  }
  return found.sort((a, b) => a.file.localeCompare(b.file))
}

const ENV_ASSIGNMENT = /^([A-Z_]+)="(?:\$[A-Z_]+\/current\/)?([^"]+)"/
const CRON_LINE = /^((?:[\d*/,-]+\s+){5})(\w+)\s+(.*)/

/** The scripts a cron line runs, with their first argument, by the paths the shell script names. */
function cronCommands(command, scripts) {
  return command
    .split(';')
    .map((part) => /bash\s+\$([A-Z_]+)\s*(\w+)?/.exec(part))
    .filter((match) => match && scripts.has(match[1]))
    .map((match) => [scripts.get(match[1]), match[2]].filter(Boolean).join(' '))
}

/** Cron lines that a shell script installs on the server, with the scripts each runs. */
export function parseServerCrons(files) {
  const found = []
  for (const { file, text } of files) {
    const lines = text.split('\n')
    const scripts = new Map(
      lines
        .map((line) => ENV_ASSIGNMENT.exec(line))
        .filter(Boolean)
        .map((m) => [m[1], m[2]]),
    )
    for (const line of lines) {
      const match = CRON_LINE.exec(line)
      if (match) {
        found.push({ file, cron: match[1].trim(), runs: cronCommands(match[3], scripts) })
      }
    }
  }
  return found.sort((a, b) => a.file.localeCompare(b.file))
}

/** The schedule setting of the intelligence pipeline, or null. */
export function parseIntelligenceSchedule({ file, text }) {
  const schedule = yaml.load(text)?.schedule
  if (!schedule?.cron) return null
  return { file, cron: schedule.cron, timezone: schedule.timezone ?? '' }
}

/** Dependabot's update schedules, one per ecosystem and folder. */
export function parseDependabot({ file, text }) {
  const updates = yaml.load(text)?.updates ?? []
  return updates.map((update) => ({
    file,
    ecosystem: update['package-ecosystem'],
    directory: update.directory,
    when: [update.schedule?.interval, update.schedule?.day && `on ${update.schedule.day}`]
      .filter(Boolean)
      .join(' '),
  }))
}
