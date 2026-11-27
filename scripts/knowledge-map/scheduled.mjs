/**
 * The scheduled tasks of the map (#1462): the tasks that run in the owner's cloud account, listed
 * on a page written by hand, and the timers the generated jobs reference found outside the
 * application (the server cron, the pipeline setting, dependency updates). Pure.
 */
import { makeEdge, makeNode, nodeId } from './graph.mjs'

const STOP_HEADING = /^## Not covered here/i
const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** The tasks of the scheduled-tasks page: each `##` section with its `- **Label:** text` items. */
export function parseScheduledPage(markdown) {
  const tasks = []
  let current = null
  let fact = null
  for (const line of markdown.split('\n')) {
    if (STOP_HEADING.test(line)) break
    const heading = /^## (.+)$/.exec(line)
    if (heading) {
      current = { name: heading[1].trim(), facts: [] }
      tasks.push(current)
      fact = null
      continue
    }
    if (!current) continue
    const item = /^- \*\*([^:*]+):\*\*\s*(.*)$/.exec(line)
    if (item) {
      fact = { label: item[1].trim(), value: item[2].trim() }
      current.facts.push(fact)
    } else if (fact && /^\s+\S/.test(line)) fact.value += ` ${line.trim()}`
    else fact = null
  }
  return tasks
}

/** `{ nodes, edges, gaps }`; `extras` are the timers the jobs reference found outside the application. */
export function buildScheduledTasks({ page, extras, groupId }) {
  const nodes = []
  const add = (node) => nodes.push(makeNode({ type: 'scheduled-task', module: groupId, ...node }))

  for (const task of parseScheduledPage(page.text)) {
    add({
      id: nodeId('scheduled-task', slug(task.name)),
      name: task.name,
      path: page.path,
      facts: task.facts,
    })
  }
  const perScript = new Map()
  for (const cron of extras.serverCrons) {
    // One node for each cron line, named for the script that installs it; a script with a second line gets -2, -3.
    const script = cron.file.split('/').pop().replace(/\.sh$/, '')
    const count = (perScript.get(script) ?? 0) + 1
    perScript.set(script, count)
    const suffix = count > 1 ? `-${count}` : ''
    add({
      id: nodeId('scheduled-task', `server-cron-${slug(script)}${suffix}`),
      name: `Server cron (${script}${suffix})`,
      summary: 'Installed on the server by the ops scripts.',
      path: cron.file,
      facts: [
        { label: 'Schedule', value: cron.cron },
        { label: 'Runs', value: cron.runs.join('; ') },
      ],
    })
  }
  if (extras.intelligence) {
    add({
      id: nodeId('scheduled-task', 'intelligence-pipeline'),
      name: 'Intelligence pipeline',
      summary:
        'The schedule the pipeline settings state; what starts a run from it is not recorded in the repository.',
      path: extras.intelligence.file,
      facts: [
        { label: 'Schedule', value: extras.intelligence.cron },
        ...(extras.intelligence.timezone
          ? [{ label: 'Time zone', value: extras.intelligence.timezone }]
          : []),
      ],
    })
  }
  if (extras.dependabot.length > 0) {
    add({
      id: nodeId('scheduled-task', 'dependabot'),
      name: 'Dependency updates',
      summary: 'Dependabot opens pull requests for outdated packages.',
      path: extras.dependabot[0].file,
      facts: extras.dependabot.map((entry) => ({
        label: `${entry.ecosystem} ${entry.directory}`,
        value: entry.when,
      })),
    })
  }
  const edges = nodes.map((node) => makeEdge({ from: groupId, to: node.id, type: 'contains' }))
  return { nodes, edges, gaps: [] }
}
