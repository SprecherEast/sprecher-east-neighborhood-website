/**
 * The jobs and schedules reference (#1461, decision 0019 §4): each Payload job task and job
 * runner from the loaded config, and each GitHub workflow that runs on a timer from the workflow
 * files. Pure functions: the generator passes in the loaded `jobs` config, a function that finds
 * the file a function was written in, and a function that lists the collections a file reaches.
 */
import { byOrder, noFiles } from '../content-types/callbacks.mjs'
import { functionLabel } from '../content-types/functions.mjs'
import { cell, code, fileCell, generatedNotice, table } from '../content-types/render.mjs'
import { COUNTED_CALLS_SENTENCE, reachedLinks, reasonLines } from './collectionCells.mjs'

// Payload runs up to this many jobs per pass when a runner sets no limit (`DEFAULT_LIMIT` in its index.js)
const DEFAULT_RUNNER_LIMIT = 10
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

/**
 * What the loaded `jobs` config says: `tasks`, `autoRun` (the runners) and `access`. `filesOf`
 * lists the collections a source file reaches, as `{ collection, operations }`.
 */
export function describeJobs(
  { tasks = [], autoRun = [], access = {} },
  locate = noFiles,
  filesOf = () => [],
  { endpoints = [] } = {},
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
      collections: file.startsWith('src/') ? filesOf(file, task.slug) : [],
    }
  })
  const runners = (Array.isArray(autoRun) ? autoRun : []).map((runner) => {
    const queue = runner.queue ?? DEFAULT_QUEUE
    return {
      ...withWords(runner.cron),
      queue,
      limit:
        runner.limit === undefined
          ? `${DEFAULT_RUNNER_LIMIT} (Payload’s default, none is set)`
          : String(runner.limit),
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
    runnersNote: Array.isArray(autoRun)
      ? ''
      : 'The runners are set by a function in the config, so they are not shown here.',
    access: operations.map((operation) => ({
      operation,
      name: functionLabel(access[operation], operation).name,
      file: locate(access[operation]),
      // The routes whose handler checks this operation
      endpoints: endpoints
        .filter((route) => route.guards === operation)
        .map((route) => `${route.method} ${route.path}`),
    })),
  }
}

/**
 * The routes of the jobs collection with the job access operation each handler checks, read from
 * the handler's own code (`jobsConfig.access?.run`): `guards` is that operation, or null.
 */
export const jobRoutes = (endpoints, base) =>
  endpoints.map((endpoint) => ({
    method: String(endpoint.method).toUpperCase(),
    path: `${base}${endpoint.path === '/' ? '' : endpoint.path}`,
    guards: /\baccess\??\.(\w+)/.exec(String(endpoint.handler))?.[1] ?? null,
  }))

/** The collections a task reaches, or why the cell has none: it is never left empty. */
const reached = (task) => {
  if (!task.file.startsWith('src/')) return 'Payload’s own handler, not followed'
  if (task.collections.length === 0) return 'none found by following its calls'
  return reachedLinks(task.collections)
}

export function renderJobs(jobs, workflows, { serverCrons, intelligence, dependabot }) {
  const tasks = table(
    [
      'Task',
      'Label',
      'Schedule',
      'Queue',
      'Handler written in',
      'Collections it reaches (by the handler’s own calls)',
    ],
    jobs.tasks.map((task) => [
      code(task.slug),
      cell(task.label),
      task.schedules.length > 0
        ? task.schedules.map(cronCell).join('<br>')
        : 'queued, not scheduled',
      task.queues.map(code).join(', '),
      fileCell(task.file),
      reached(task),
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
    ['Operation', 'Function', 'Defined in', 'Route it guards'],
    jobs.access.map((entry) => [
      entry.operation,
      code(entry.name),
      fileCell(entry.file),
      entry.endpoints.length > 0 ? entry.endpoints.map(code).join(', ') : 'no route in the config',
    ]),
  )
  const crons = table(
    ['File', 'Schedule', 'Runs'],
    serverCrons.map((entry) => [
      code(entry.file),
      cronCell(withWords(entry.cron)),
      entry.runs.map(code).join(', '),
    ]),
  )
  const settings = table(
    ['File', 'Schedule', 'Time zone'],
    intelligence
      ? [
          [
            code(intelligence.file),
            cronCell(withWords(intelligence.cron)),
            cell(intelligence.timezone),
          ],
        ]
      : [],
  )
  const updates = table(
    ['File', 'Ecosystem', 'Folder', 'When'],
    dependabot.map((entry) => [
      code(entry.file),
      cell(entry.ecosystem),
      code(entry.directory),
      cell(entry.when),
    ]),
  )
  const reasons = jobs.tasks
    .map((task) => reasonLines(task.collections, `${code(task.slug)}: `))
    .join('')
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
    generatedNotice(
      'the loaded Payload config (`jobs`), `.github/workflows/`, `.github/dependabot.yml`, `ops/install-cron.sh` and `intelligence/pipeline.yaml`',
    ),
    '',
    'What runs on a timer inside the application, and in GitHub. Payload starts the runners inside the app’s one process (`jobs.autoRun`), on the first request after a start. A queue with no runner never runs. Timers in browser code (a page checking the version, for example) are not shown. Time zones: the GitHub workflows run in UTC; the job schedules and the server cron set no time zone, so both follow the server’s clock, which this page does not state; the pipeline setting names its own time zone, if it has one. “Collections it reaches” are found by following the handler’s own calls in the source, with the operation and whether access is checked; a function the config passes in (such as the keepers of the confirmation retention task) is not followed, so a collection reached only that way is not listed; nor are the hooks a write sets off, which can write other collections (the search index, for example): each content type’s hooks are on its own page under Hooks. A collection passed to a shared helper is shown with what the helper does to it where its code shows that, otherwise as “operation not shown”. ' +
      COUNTED_CALLS_SENTENCE +
      ' Where access is bypassed and the code gives a reason, it is quoted below the table. Scheduled tasks that live outside the repository are on [their own page](../knowledge/scheduled-tasks.md), written by hand.',
    '',
    '## Job tasks',
    '',
    reasons ? `${tasks}\n${reasons}` : tasks,
    '',
    '## Job runners',
    '',
    jobs.runnersNote || runners,
    '',
    '## Who may queue, run and cancel jobs',
    '',
    access,
    '',
    '## Timed GitHub workflows',
    '',
    timed,
    '',
    '## Cron installed on the server',
    '',
    'Installed on every deploy by a script in the repository, so the job on the server matches the file. The server’s clock applies (see the time zones in the introduction). What the scripts do is in `ops/README.md`.',
    '',
    crons,
    '',
    '## The intelligence pipeline’s setting',
    '',
    'The schedule the pipeline settings state. What starts it, and where, is outside the repository and is on [the scheduled tasks page](../knowledge/scheduled-tasks.md).',
    '',
    settings,
    '',
    '## Dependabot',
    '',
    updates,
    '',
  ].join('\n')
}
