/**
 * The AI agent tools of the map (#1462): a node for each tool (the ones the MCP plugin makes for
 * content types and the ones the site adds), the content types each reaches and how, and the
 * endpoint that exposes them. Read from the structured tool facts. Pure.
 */
import { makeEdge, makeNode, nodeId } from './graph.mjs'

const READS = new Set(['find', 'read', 'count'])
const WRITES = new Set(['create', 'update', 'delete', 'duplicate', 'restore'])
const accessText = (access) => (access ? `${access.name} (${access.file})` : '')

/** The edge type of an operation word: finding and reading read; creating, updating and deleting write; an operation the source does not show only uses. */
export const edgeTypeOf = (operation) =>
  READS.has(operation) ? 'reads' : WRITES.has(operation) ? 'writes' : 'uses'

/**
 * `{ nodes, edges, gaps }`. `holderId` is the module that holds the tools, `endpointId` the AI
 * agent endpoint, `contentTypeIds` the ids of the collections and globals.
 */
export function buildTools({ mcp, contentTypeIds, holderId, endpointId }) {
  const nodes = []
  const edges = []
  const gaps = []
  const known = new Map(contentTypeIds.map((id) => [id.split(':')[1], id]))

  const add = (node, reaches) => {
    const id = nodeId('mcp-tool', node.name)
    nodes.push(makeNode({ ...node, id, type: 'mcp-tool', module: holderId }))
    edges.push(makeEdge({ from: holderId, to: id, type: 'contains' }))
    edges.push(makeEdge({ from: endpointId, to: id, type: 'exposes' }))
    for (const { slug, operations } of reaches) {
      const target = known.get(slug)
      if (!target) {
        gaps.push({
          kind: 'reference-target-missing',
          node: id,
          message: `reaches "${slug}", which is not a content type`,
        })
        continue
      }
      for (const text of operations) {
        edges.push(
          makeEdge({ from: id, to: target, type: edgeTypeOf(text.split(' ')[0]), via: [text] }),
        )
      }
    }
  }

  for (const tool of mcp.collectionTools) {
    add(
      {
        name: tool.name,
        summary: tool.description,
        path: mcp.auth.file,
        facts: [
          { label: 'Operation', value: tool.operation },
          { label: 'Content type', value: tool.target },
          { label: 'Access function', value: accessText(tool.access) },
        ],
      },
      [{ slug: tool.target, operations: [tool.operation] }],
    )
  }
  for (const tool of mcp.customTools) {
    add(
      {
        name: tool.name,
        summary: tool.description,
        path: tool.file,
        fields: tool.input.map((input) => ({
          name: input.name,
          type: input.type,
          required: input.required === 'yes',
          detail: input.note,
          notes: [],
        })),
        facts: [{ label: 'Kind', value: 'written for this site' }],
      },
      tool.collections.map((reach) => ({ slug: reach.collection, operations: reach.operations })),
    )
  }
  return { nodes, edges, gaps }
}
