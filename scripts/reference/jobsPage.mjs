/**
 * The jobs and schedules page (#1461): tables written from what `describeJobs` found and from the
 * timed workflows, server cron lines, pipeline setting and Dependabot entries.
 */
import { cell, code, fileCell, generatedNotice, table } from '../content-types/render.mjs'
import { COUNTED_CALLS_SENTENCE, reachedLinks, reasonLines } from './collectionCells.mjs'
import { scheduleHooks, withWords } from './jobs.mjs'

const cronCell = ({ cron, words }) => (words ? `${code(cron)} (${words})` : code(cron))

/** The collections a task reaches, or why the cell has none: it is never left empty. */
const reached = (task) => {
  if (!task.file.startsWith('src/')) return 'Payload’s own handler, not followed'
  if (task.collections.length === 0) return 'none found by following its calls'
  return reachedLinks(task.collections)
}

/** A schedule: the cron in words, then each hook that runs before the tasks are queued. */
const scheduleCell = (schedule) =>
  [
    cronCell(schedule),
    ...schedule.hooks.map((hook) => `${code(hook.phase)} hook ${code(hook.name)}`),
  ].join('<br>')

const tasksTable = (tasks) =>
  table(
    [
      'Task',
      'Label',
      'Schedule',
      'Queue',
      'Handler written in',
      'Collections it reaches (by the handler’s own calls)',
    ],
    tasks.map((task) => [
      code(task.slug),
      cell(task.label),
      task.schedules.length > 0
        ? task.schedules.map(scheduleCell).join('<br>')
        : 'queued, not scheduled',
      task.queues.map(code).join(', '),
      fileCell(task.file),
      reached(task),
    ]),
  )

const hooksTable = (tasks) =>
  table(
    ['Hook', 'Phase', 'Written in', 'Used by', 'Collections it reaches'],
    scheduleHooks(tasks).map((hook) => [
      code(hook.name),
      code(hook.phase),
      fileCell(hook.file),
      hook.tasks.map(code).join(', '),
      hook.collections.length > 0
        ? reachedLinks(hook.collections)
        : 'none found by following its calls',
    ]),
  )

const runnersTable = (runners) =>
  table(
    ['Queue', 'Runs', 'Limit per run', 'Scheduling pass', 'Tasks in the queue'],
    runners.map((runner) => [
      code(runner.queue),
      cronCell(runner),
      runner.limit,
      runner.schedulingPass,
      runner.tasks.map(code).join(', '),
    ]),
  )

const accessTable = (access) =>
  table(
    ['Operation', 'Function', 'Defined in', 'Route it guards'],
    access.map((entry) => [
      entry.operation,
      code(entry.name),
      fileCell(entry.file),
      entry.endpoints.length > 0 ? entry.endpoints.map(code).join(', ') : 'no route in the config',
    ]),
  )

const workflowsTable = (workflows) =>
  table(
    ['File', 'Workflow', 'Schedule (UTC)', 'Jobs'],
    workflows.map((workflow) => [
      code(workflow.file),
      cell(workflow.name),
      workflow.crons.map((cron) => cronCell(withWords(cron))).join('<br>'),
      cell(workflow.jobs.join(', ')),
    ]),
  )

const cronsTable = (serverCrons) =>
  table(
    ['File', 'Schedule', 'Runs'],
    serverCrons.map((entry) => [
      code(entry.file),
      cronCell(withWords(entry.cron)),
      entry.runs.map(code).join(', '),
    ]),
  )

const settingsTable = (intelligence) =>
  table(
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

const updatesTable = (dependabot) =>
  table(
    ['File', 'Ecosystem', 'Folder', 'When'],
    dependabot.map((entry) => [
      code(entry.file),
      cell(entry.ecosystem),
      code(entry.directory),
      cell(entry.when),
    ]),
  )

const INTRO =
  'What runs on a timer inside the application, and in GitHub. Payload starts the runners inside the app’s one process (`jobs.autoRun`), on the first request after a start. A queue with no runner never runs. Timers in browser code (a page checking the version, for example) are not shown. Time zones: the GitHub workflows run in UTC; the job schedules and the server cron set no time zone, so both follow the server’s clock, which this page does not state; the pipeline setting names its own time zone, if it has one. “Collections it reaches” are found by following the handler’s own calls in the source, and those of a schedule’s hooks, with the operation and whether access is checked; a function the config passes in (such as the keepers of the confirmation retention task) is not followed, so a collection reached only that way is not listed; nor are the hooks a write sets off, which can write other collections (the search index, for example): each content type’s hooks are on its own page under Hooks. A collection passed to a shared helper is shown with what the helper does to it where its code shows that, otherwise as “operation not shown”. ' +
  COUNTED_CALLS_SENTENCE +
  ' Where access is bypassed and the code gives a reason, it is quoted below the table. Scheduled tasks that live outside the repository are on [their own page](../knowledge/scheduled-tasks.md), written by hand.'

export function renderJobs(jobs, workflows, { serverCrons, intelligence, dependabot }) {
  const hooks = scheduleHooks(jobs.tasks)
  const reasons =
    jobs.tasks.map((task) => reasonLines(task.collections, `${code(task.slug)}: `)).join('') +
    hooks.map((hook) => reasonLines(hook.collections, `${code(hook.name)}: `)).join('')
  const tasks = tasksTable(jobs.tasks)
  const hookSection =
    hooks.length > 0
      ? [
          '## Schedule hooks',
          '',
          'A hook runs each time a schedule queues its tasks. The collections are found by following its own calls.',
          '',
          hooksTable(jobs.tasks),
          '',
        ]
      : []
  return [
    '# Jobs and schedules',
    '',
    generatedNotice(
      'the loaded Payload config (`jobs`), `.github/workflows/`, `.github/dependabot.yml`, `ops/install-cron.sh` and `intelligence/pipeline.yaml`',
    ),
    '',
    INTRO,
    '',
    '## Job tasks',
    '',
    reasons ? `${tasks}\n${reasons}` : tasks,
    '',
    ...hookSection,
    '## Job runners',
    '',
    jobs.runnersNote || runnersTable(jobs.runners),
    '',
    '## Who may queue, run and cancel jobs',
    '',
    accessTable(jobs.access),
    '',
    '## Timed GitHub workflows',
    '',
    workflowsTable(workflows),
    '',
    '## Cron installed on the server',
    '',
    'Installed on every deploy by a script in the repository, so the job on the server matches the file. The server’s clock applies (see the time zones in the introduction). What the scripts do is in `ops/README.md`.',
    '',
    cronsTable(serverCrons),
    '',
    '## The intelligence pipeline’s setting',
    '',
    'The schedule the pipeline settings state. What starts it, and where, is outside the repository and is on [the scheduled tasks page](../knowledge/scheduled-tasks.md).',
    '',
    settingsTable(intelligence),
    '',
    '## Dependabot',
    '',
    updatesTable(dependabot),
    '',
  ].join('\n')
}
