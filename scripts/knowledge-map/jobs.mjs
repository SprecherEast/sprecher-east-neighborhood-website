/**
 * The jobs of the map (#1462): a node for each task Payload runs on a schedule or a queue, when and
 * where it runs, and the content types it reaches. Read from the structured job facts. Pure.
 */
import { makeEdge, makeNode, nodeId } from './graph.mjs'
import { edgeTypeOf } from './tools.mjs'

const JOBS_PAGE = 'docs/reference/jobs.md'

const timing = (cron, words) => `${cron} (${words})`

/** `{ nodes, edges, gaps }`; `payloadId` holds the tasks Payload makes itself. */
export function buildJobs({ scheduled, contentTypeIds, ownerOf, payloadId }) {
  const known = new Map(contentTypeIds.map((id) => [id.split(':')[1], id]))
  const runners = new Map(scheduled.jobs.runners.map((runner) => [runner.queue, runner]))
  const nodes = []
  const edges = []
  const gaps = []

  for (const task of scheduled.jobs.tasks) {
    const own = task.file.startsWith('src/')
    const parent = (own && ownerOf(task.file)?.top) || payloadId
    const id = nodeId('job', task.slug)
    const facts = []
    for (const schedule of task.schedules) {
      facts.push({ label: 'Schedule', value: timing(schedule.cron, schedule.words) })
      for (const hook of schedule.hooks) {
        facts.push({ label: 'Before it is queued', value: `${hook.name} (${hook.file})` })
      }
    }
    if (task.schedules.length === 0)
      facts.push({ label: 'Schedule', value: 'queued, not scheduled' })
    for (const queue of task.queues) {
      facts.push({ label: 'Queue', value: queue })
      const runner = runners.get(queue)
      if (runner)
        facts.push({
          label: 'Runner',
          value: `${timing(runner.cron, runner.words)}, up to ${runner.limit.split(' ')[0]} per run`,
        })
    }
    nodes.push(
      makeNode({
        id,
        type: 'job',
        name: task.slug,
        summary: task.label,
        path: own ? task.file : JOBS_PAGE,
        module: parent,
        facts,
        links: [JOBS_PAGE],
      }),
    )
    edges.push(makeEdge({ from: parent, to: id, type: 'contains' }))
    for (const reach of task.collections) {
      const target = known.get(reach.collection)
      if (!target) {
        gaps.push({
          kind: 'reference-target-missing',
          node: id,
          message: `reaches "${reach.collection}", which is not a content type`,
        })
        continue
      }
      for (const text of reach.operations) {
        edges.push(
          makeEdge({ from: id, to: target, type: edgeTypeOf(text.split(' ')[0]), via: [text] }),
        )
      }
    }
  }
  return { nodes, edges, gaps }
}
