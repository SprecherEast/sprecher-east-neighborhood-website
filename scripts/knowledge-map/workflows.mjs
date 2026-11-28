/**
 * The GitHub workflows of the map (#1462): a node for each workflow with what starts it, and one
 * for each of its jobs, the mechanical checks. Read from the workflow YAML. Pure.
 */
import path from 'node:path'
import yaml from 'js-yaml'

import { makeEdge, makeNode, nodeId } from './graph.mjs'

const EVENT_NAMES = {
  pull_request: 'pull request',
  workflow_dispatch: 'manual run',
  workflow_run: 'another workflow',
  pull_request_target: 'pull request (target)',
}

/** What starts a workflow, in plain words: each event with its branches, and each schedule. */
function triggers(on) {
  if (typeof on === 'string') return [EVENT_NAMES[on] ?? on]
  if (Array.isArray(on)) return on.map((event) => EVENT_NAMES[event] ?? event)
  return Object.entries(on ?? {}).flatMap(([event, detail]) => {
    if (event === 'schedule') return (detail ?? []).map((entry) => `schedule ${entry.cron}`)
    const name = EVENT_NAMES[event] ?? event
    const branches = detail?.branches
    return [
      Array.isArray(branches) && branches.length > 0 ? `${name} (${branches.join(', ')})` : name,
    ]
  })
}

const commandsOf = (job) =>
  (job.steps ?? [])
    .map((step) => (typeof step.run === 'string' ? step.run.trim().split('\n')[0].trim() : ''))
    .filter(Boolean)

function parse(file) {
  try {
    return yaml.load(file.text) ?? {}
  } catch (error) {
    throw new Error(`${file.path} is not valid YAML: ${String(error.message).split('\n')[0]}`)
  }
}

/** `{ nodes, edges, gaps }`; `groupId` holds the workflows. */
export function buildWorkflows({ workflows, groupId }) {
  const nodes = []
  const edges = []
  for (const file of workflows) {
    const data = parse(file)
    const key = path.posix.basename(file.path).replace(/\.ya?ml$/, '')
    const id = nodeId('ci-workflow', key)
    // YAML reads the key `on` as the boolean true
    const on = data.on ?? data[true]
    nodes.push(
      makeNode({
        id,
        type: 'ci-workflow',
        name: data.name ?? key,
        path: file.path,
        facts: [{ label: 'Starts on', value: triggers(on).join(', ') }],
      }),
    )
    edges.push(makeEdge({ from: groupId, to: id, type: 'contains' }))
    for (const [jobKey, job] of Object.entries(data.jobs ?? {})) {
      const checkId = nodeId('check', `${key}#${jobKey}`)
      const commands = commandsOf(job)
      nodes.push(
        makeNode({
          id: checkId,
          type: 'check',
          name: job.name ?? jobKey,
          path: file.path,
          facts: commands.length > 0 ? [{ label: 'Runs', value: commands.join('; ') }] : [],
        }),
      )
      edges.push(makeEdge({ from: id, to: checkId, type: 'contains' }))
      const reused = job.uses?.match(/^\.\/(\.github\/workflows\/[^@\s]+\.ya?ml)$/)?.[1]
      if (reused)
        edges.push(makeEdge({ from: id, to: `path:${reused}`, type: 'calls', via: [jobKey] }))
    }
  }
  return { nodes, edges, gaps: [] }
}
