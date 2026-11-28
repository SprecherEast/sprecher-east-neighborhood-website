/**
 * The open tasks of each node (#1462, choice C1): a dated snapshot of the open issues, matched to
 * nodes by each issue's declared "Files likely touched". It changes without a code change, so it is
 * never part of the committed graph. Pure: the issues are given. The matching reuses the overlap
 * check's reader, so nothing parses an issue body twice.
 */
import path from 'node:path'

import { parseDeclared, pathsOverlap } from '../overlap-check.mjs'

const AREA_TYPES = ['module', 'platform-area', 'feature']

/** A snapshot with no issues, marked as such with the reason. */
export const emptySnapshot = (reason, date) => ({
  available: false,
  reason,
  date,
  issues: 0,
  nodes: {},
})

/** What a node covers for matching: an area's folder, otherwise the node's own path. */
const coverOf = (node) =>
  AREA_TYPES.includes(node.type) && node.path.endsWith('.md')
    ? path.posix.dirname(node.path)
    : node.path

/** `{ available, date, issues, nodes: { id: [{ number, title, url, labels }] } }`. */
export function buildSnapshot({ graph, issues, date }) {
  const open = issues.filter((issue) => !issue.pull_request)
  const nodes = {}
  for (const issue of open) {
    const declared = parseDeclared(issue.body).files ?? []
    if (declared.length === 0) continue
    const task = {
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      labels: (issue.labels ?? []).map((l) => l.name ?? l),
    }
    for (const node of graph.nodes) {
      const cover = coverOf(node)
      if (declared.some((file) => pathsOverlap(file, cover))) (nodes[node.id] ??= []).push(task)
    }
  }
  for (const tasks of Object.values(nodes)) tasks.sort((a, b) => a.number - b.number)
  return {
    available: true,
    date,
    issues: open.length,
    nodes: Object.fromEntries(Object.entries(nodes).sort(([a], [b]) => (a < b ? -1 : 1))),
  }
}
