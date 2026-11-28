/**
 * The jobs and schedules reference (#1461, decision 0019 §4): each Payload job task and job
 * runner from the loaded config, and each GitHub workflow that runs on a timer from the workflow
 * files. Pure functions: the generator passes in the loaded `jobs` config, a function that finds
 * the file a function was written in, and a function that lists the collections a file reaches.
 */
import { byOrder, noFiles } from '../content-types/callbacks.mjs'
import { functionLabel } from '../content-types/functions.mjs'

// Payload runs up to this many jobs per pass when a runner sets no limit (`DEFAULT_LIMIT` in its index.js)
const DEFAULT_RUNNER_LIMIT = 10
export const DEFAULT_QUEUE = 'default'
const JOB_ACCESS_ORDER = ['queue', 'run', 'cancel']

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const pad = (number) => String(number).padStart(2, '0')

/** Words for the cron patterns this site uses; an empty string for any other, so the expression stands alone. */
export function describeCron(expression) {
  const [minute, hour, day, month, weekday] = expression.trim().split(/\s+/)
  if (expression.trim().split(/\s+/).length !== 5) return ''
  if (day === '*' && month === '*' && /^[0-7]$/.test(weekday)) {
    if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) return ''
    return `every ${WEEKDAYS[Number(weekday) % 7]} at ${pad(hour)}:${pad(minute)}`
  }
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

export const withWords = (cron) => ({ cron, words: describeCron(cron) })

/** The hooks of one schedule entry, each with the collections its function reaches. */
const describeScheduleHooks = (task, entry, locate, filesOf) =>
  Object.entries(entry.hooks ?? {})
    .filter(([, hook]) => typeof hook === 'function')
    .map(([phase, hook]) => {
      const name = functionLabel(hook, phase).name
      const file = locate(hook)
      return {
        phase,
        name,
        file,
        collections: file.startsWith('src/') ? filesOf(file, task.slug, name) : [],
      }
    })

const describeTask = (task, locate, filesOf) => {
  const schedules = (task.schedule ?? []).map((entry) => ({
    ...withWords(entry.cron),
    queue: entry.queue ?? DEFAULT_QUEUE,
    hooks: describeScheduleHooks(task, entry, locate, filesOf),
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
}

const describeRunner = (runner, tasks) => {
  const queue = runner.queue ?? DEFAULT_QUEUE
  return {
    ...withWords(runner.cron),
    queue,
    limit:
      runner.limit === undefined
        ? `${DEFAULT_RUNNER_LIMIT} (Payload’s default, none is set)`
        : String(runner.limit),
    schedulingPass: runner.disableScheduling ? 'no' : 'yes',
    tasks: tasks.filter((task) => task.queues.includes(queue)).map((task) => task.slug),
  }
}

const describeJobAccess = (access, locate, endpoints) =>
  Object.keys(access)
    .filter((operation) => typeof access[operation] === 'function')
    .sort(byOrder(JOB_ACCESS_ORDER))
    .map((operation) => ({
      operation,
      name: functionLabel(access[operation], operation).name,
      file: locate(access[operation]),
      // The routes whose handler checks this operation
      endpoints: endpoints
        .filter((route) => route.guards === operation)
        .map((route) => `${route.method} ${route.path}`),
    }))

/**
 * What the loaded `jobs` config says: `tasks`, `autoRun` (the runners) and `access`. `filesOf`
 * lists the collections a source file reaches, as `{ collection, operations }`: from a task's
 * handler, or, given a function name as a third argument, from that function (a schedule hook).
 */
export function describeJobs(
  { tasks = [], autoRun = [], access = {} },
  locate = noFiles,
  filesOf = () => [],
  { endpoints = [] } = {},
) {
  const described = tasks.map((task) => describeTask(task, locate, filesOf))
  return {
    tasks: described,
    runners: (Array.isArray(autoRun) ? autoRun : []).map((runner) =>
      describeRunner(runner, described),
    ),
    runnersNote: Array.isArray(autoRun)
      ? ''
      : 'The runners are set by a function in the config, so they are not shown here.',
    access: describeJobAccess(access, locate, endpoints),
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

/** The hooks the schedules of the tasks run, each once, with the tasks that use it. */
export function scheduleHooks(tasks) {
  const found = new Map()
  for (const task of tasks) {
    for (const schedule of task.schedules) {
      for (const hook of schedule.hooks) {
        const key = `${hook.file} ${hook.name} ${hook.phase}`
        const entry = found.get(key) ?? { ...hook, tasks: [] }
        if (!entry.tasks.includes(task.slug)) entry.tasks.push(task.slug)
        found.set(key, entry)
      }
    }
  }
  return [...found.values()].sort(
    (a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file),
  )
}

/** The tasks that reach a collection: through their handler, or through a hook of their schedule. */
export const tasksReaching = (tasks, slug) =>
  tasks
    .filter(
      (task) =>
        task.collections.some((c) => c.collection === slug) ||
        task.schedules.some((schedule) =>
          schedule.hooks.some((hook) => hook.collections.some((c) => c.collection === slug)),
        ),
    )
    .map((task) => task.slug)
