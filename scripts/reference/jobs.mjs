/**
 * The jobs and schedules reference (#1461, decision 0019 §4): each Payload job task and job
 * runner from the loaded config, and each GitHub workflow that runs on a timer from the workflow
 * files. Pure functions: the generator passes in the loaded `jobs` config, a function that finds
 * the file a function was written in, and a function that lists the collections a file reaches.
 */
import yaml from 'js-yaml'

import { byOrder, noFiles } from '../content-types/callbacks.mjs'
import { functionLabel } from '../content-types/functions.mjs'
import { cell, code, fileCell, generatedNotice, table } from '../content-types/render.mjs'
import { operationsSuffix } from './sourceFacts.mjs'

export const DEFAULT_QUEUE = 'default'
const JOB_ACCESS_ORDER = ['queue', 'run', 'cancel']

const pad = (number) => String(number).padStart(2, '0')

/** Words for the cron patterns this site uses; an empty string for any other, so the expression stands alone. */
export function describeCron(expression) {
  const [minute, hour, day, month, weekday] = expression.trim().split(/\s+/)
  if (expression.trim().split(/\s+/).length !== 5) return ''
  const rest = [day, month, weekday].every((part) => part === '*')
  if (!rest) return ''
  if (minute === '*' && hour === '*') return 'every minute'
  const every = /^\*\/(\d+)$/.exec(minute)
  if (every && hour === '*') return `every ${every[1]} minutes`
  if (!/^\d+$/.test(minute)) return ''
  if (hour === '*')
    return minute === '0' ? 'every hour, on the hour' : `every hour at minute ${minute}`
  if (/^\d+$/.test(hour)) return `every day at ${pad(hour)}:${pad(minute)}`
  return ''
}

const withWords = (cron) => ({ cron, words: describeCron(cron) })
const cronCell = ({ cron, words }) => (words ? `${code(cron)} (${words})` : code(cron))

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

/**
 * What the loaded `jobs` config says: `tasks`, `autoRun` (the runners) and `access`. `filesOf`
 * lists the collections a source file reaches, as `{ collection, operations }`.
 */
export function describeJobs(
  { tasks = [], autoRun = [], access = {} },
  locate = noFiles,
  filesOf = () => [],
) {
  const described = tasks.map((task) => {
    const schedules = (task.schedule ?? []).map((entry) => ({
      ...withWords(entry.cron),
      queue: entry.queue ?? DEFAULT_QUEUE,
    }))
    const queues = [...new Set(schedules.map((entry) => entry.queue))]
    const file = locate(task.handler)
    return {
      slug: task.slug,
      label: typeof task.label === 'string' ? task.label : '',
      schedules,
      queues: queues.length > 0 ? queues : [DEFAULT_QUEUE],
      file,
      collections: file.startsWith('src/') ? filesOf(file) : [],
    }
  })
  const runners = (Array.isArray(autoRun) ? autoRun : []).map((runner) => {
    const queue = runner.queue ?? DEFAULT_QUEUE
    return {
      ...withWords(runner.cron),
      queue,
      limit: runner.limit === undefined ? '' : String(runner.limit),
      schedulingPass: runner.disableScheduling ? 'no' : 'yes',
      tasks: described.filter((task) => task.queues.includes(queue)).map((task) => task.slug),
    }
  })
  const operations = Object.keys(access)
    .filter((operation) => typeof access[operation] === 'function')
    .sort(byOrder(JOB_ACCESS_ORDER))
  return {
    tasks: described,
    runners,
    access: operations.map((operation) => ({
      operation,
      name: functionLabel(access[operation], operation).name,
      file: locate(access[operation]),
    })),
  }
}

const reached = (collections) =>
  collections
    .map(({ collection, operations }) => `${code(collection)}${operationsSuffix(operations)}`)
    .join(', ')

export function renderJobs(jobs, workflows) {
  const tasks = table(
    ['Task', 'Label', 'Schedule', 'Queue', 'Handler written in', 'Collections it reaches'],
    jobs.tasks.map((task) => [
      code(task.slug),
      cell(task.label),
      task.schedules.length > 0
        ? task.schedules.map(cronCell).join('<br>')
        : 'queued, not scheduled',
      task.queues.map(code).join(', '),
      fileCell(task.file),
      reached(task.collections),
    ]),
  )
  const runners = table(
    ['Queue', 'Runs', 'Limit per run', 'Scheduling pass', 'Tasks in the queue'],
    jobs.runners.map((runner) => [
      code(runner.queue),
      cronCell(runner),
      runner.limit,
      runner.schedulingPass,
      runner.tasks.map(code).join(', '),
    ]),
  )
  const access = table(
    ['Operation', 'Function', 'Defined in'],
    jobs.access.map((entry) => [entry.operation, code(entry.name), fileCell(entry.file)]),
  )
  const timed = table(
    ['File', 'Workflow', 'Schedule (UTC)', 'Jobs'],
    workflows.map((workflow) => [
      code(workflow.file),
      cell(workflow.name),
      workflow.crons.map((cron) => cronCell(withWords(cron))).join('<br>'),
      cell(workflow.jobs.join(', ')),
    ]),
  )
  return [
    '# Jobs and schedules',
    '',
    generatedNotice('the loaded Payload config (`jobs`) and `.github/workflows/`'),
    '',
    'What runs on a timer inside the application, and in GitHub. Payload starts the runners inside the app’s one process (`jobs.autoRun`), on the first request after a start. A queue with no runner never runs. “Collections it reaches” are the collections the handler’s own module code reads or changes through the Local API, found in the source. Scheduled tasks that live outside the repository are on [their own page](../knowledge/scheduled-tasks.md), written by hand.',
    '',
    '## Job tasks',
    '',
    tasks,
    '',
    '## Job runners',
    '',
    runners,
    '',
    '## Who may queue, run and cancel jobs',
    '',
    access,
    '',
    '## Timed GitHub workflows',
    '',
    timed,
    '',
  ].join('\n')
}
