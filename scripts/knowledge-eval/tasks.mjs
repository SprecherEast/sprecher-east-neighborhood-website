import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const TASKS_FILE = fileURLToPath(new URL('./tasks.json', import.meta.url))

/** The task set (#715): `tasks.json`, one entry per task. */
export function loadTasks() {
  return JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'))
}

/** The tasks a run covers: `--tasks` ids when given, else the `core` ones for `--set core`, else all. */
export function selectTasks(tasks, { tasks: ids = null, set = 'all' } = {}) {
  if (ids) return tasks.filter((t) => ids.includes(t.id))
  return set === 'core' ? tasks.filter((t) => t.core) : tasks
}

/** What is wrong with a task set, one line each; empty when every task can be graded. */
export function validateTasks(tasks) {
  const problems = []
  const seen = new Set()
  for (const task of tasks) {
    const at = `task ${task.id}`
    if (seen.has(task.id)) problems.push(`${at}: duplicate id`)
    seen.add(task.id)
    if (!task.prompt?.trim()) problems.push(`${at}: empty prompt`)
    if (task.level !== undefined && ![1, 2, 3].includes(task.level))
      problems.push(`${at}: level must be 1, 2 or 3`)
    if (task.style !== undefined && !['vague', 'specific', 'cross'].includes(task.style))
      problems.push(`${at}: style must be vague, specific or cross`)
    if (task.kind === 'question') {
      if (!task.key?.length) problems.push(`${at}: a question needs a non-empty key`)
    } else if (task.kind === 'change') {
      if (!task.commands?.length) problems.push(`${at}: a change needs commands`)
      if (!task.mustChange?.length) problems.push(`${at}: a change needs mustChange`)
    } else {
      problems.push(`${at}: unknown kind ${task.kind}`)
    }
  }
  return problems
}
