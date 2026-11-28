/**
 * The vocabulary of the system map (#1462): the node types, the relationship types and the layers
 * a relationship sits on. The node and relationship types of the note schema
 * (`docs/knowledge/note-schema.json`, decision 0022) are the base; this file adds only what the
 * scanner finds in the repository beyond notes, and the layers, which the schema has no word for.
 * A test keeps the two in step, so nothing is defined twice.
 */

/** Node types the scanner adds to the schema's, by the schema's own two groups. */
const EXTRA_NODE_TYPES = {
  product: {
    'page-cluster': 'Screens that share the first part of their address (all of /events, say).',
    'business-rule': 'One rule a note states, with the tests that protect it.',
    library: 'An outside package the application depends on.',
  },
  'how-we-work': {
    group: 'A heading the scanner makes to hold a kind of thing (all skills, all roles).',
    rule: 'A rule file Claude Code loads when the work touches matching files.',
    'process-doc': 'A document under docs/process/ on how work is planned and tracked.',
  },
}

/** Relationship types the scanner adds to the schema's. */
const EXTRA_EDGE_TYPES = {
  references: 'A field of one content type points at another (relationship or upload field).',
  joins: 'A content type reads the documents of another that point back at it (join field).',
  hooks: 'A hook written in one area runs when a content type of another area changes.',
  edits: 'An Admin screen where editors change a content type.',
  mirrors: 'A generated rule file that is a copy of a note or a guideline.',
}

/** The layers of relationships, in the order a reader switches them: one plain sentence each. */
/** The repository the map describes; the page builds its GitHub links from this. */
export const REPOSITORY = { owner: 'SprecherEast', name: 'sprecher-east-neighborhood-website' }

export const LAYERS = [
  {
    key: 'structure',
    label: 'Structure',
    what: 'What contains what: the site, its modules, groups and parts.',
  },
  {
    key: 'docs',
    label: 'Notes and decisions',
    what: 'Which note describes what, which documents link to which, and which decision explains a part.',
  },
  {
    key: 'code',
    label: 'Code dependencies',
    what: 'Which module or screen builds on which shared area, or another part.',
  },
  {
    key: 'ui',
    label: 'Components',
    what: 'Which shared components a module, area or screen uses.',
  },
  {
    key: 'data',
    label: 'Data model',
    what: 'Content types, the fields that point at each other, hooks, Admin screens and who reads or writes them.',
  },
  {
    key: 'api',
    label: 'API',
    what: 'Endpoints and server actions, and the content types they expose.',
  },
  {
    key: 'mcp',
    label: 'AI agent tools',
    what: 'The tools AI agents call through MCP, and the content types they reach.',
  },
  {
    key: 'jobs',
    label: 'Jobs and schedules',
    what: 'Work that runs on a timer or a queue, and what it reaches.',
  },
  { key: 'libraries', label: 'Libraries', what: 'Outside packages and the parts that use them.' },
  {
    key: 'skills',
    label: 'Agent skills',
    what: 'The procedures agents follow, and what they point to.',
  },
  {
    key: 'agents',
    label: 'Roles and AI agents',
    what: 'Role guides and agent definitions, and who owns what.',
  },
  {
    key: 'rules',
    label: 'Rules and guidelines',
    what: 'Conventions and the rule files that load them for agents.',
  },
  { key: 'ci', label: 'CI and checks', what: 'Workflows, their checks and what starts them.' },
]

const DATA_TYPES = ['reads', 'writes', 'references', 'joins', 'hooks', 'edits']
const DOC_TYPES = ['documents', 'mentions', 'decided-by']

/**
 * Where a relationship sits: the first rule that matches its type and the types of its two ends.
 * Ordered, so a more specific rule comes before a broader one.
 */
export const EDGE_LAYER_RULES = [
  { layer: 'structure', types: ['contains'] },
  { layer: 'libraries', toTypes: ['library'] },
  { layer: 'ui', toTypes: ['shared-component'] },
  { layer: 'data', toTypes: ['block'] },
  { layer: 'mcp', fromTypes: ['mcp-tool'] },
  { layer: 'api', fromTypes: ['endpoint'] },
  { layer: 'jobs', fromTypes: ['job', 'scheduled-task'] },
  { layer: 'data', types: DATA_TYPES },
  { layer: 'skills', fromTypes: ['skill'] },
  { layer: 'agents', fromTypes: ['role', 'subagent'] },
  { layer: 'rules', fromTypes: ['rule', 'guideline', 'process-doc'] },
  { layer: 'ci', fromTypes: ['ci-workflow', 'check', 'workflow-step'] },
  { layer: 'docs', types: DOC_TYPES },
  { layer: 'code' },
]

const matches = (list, value) => list === undefined || list.includes(value)

/** The layer of one relationship: `{ type, fromType, toType }`. */
export function layerOf({ type, fromType, toType }) {
  const rule = EDGE_LAYER_RULES.find(
    (r) => matches(r.types, type) && matches(r.fromTypes, fromType) && matches(r.toTypes, toType),
  )
  return rule.layer
}

/**
 * The node types and relationship types: the schema's, then the extras. A node type is
 * `{ group, what }`, a relationship type its sentence. Throws when an extra repeats a schema key.
 */
export function vocabulary(schema) {
  const nodeTypes = {}
  for (const [group, types] of Object.entries(schema.nodeTypes)) {
    for (const [key, what] of Object.entries(types)) nodeTypes[key] = { group, what }
  }
  for (const [group, types] of Object.entries(EXTRA_NODE_TYPES)) {
    for (const [key, what] of Object.entries(types)) {
      if (nodeTypes[key]) throw new Error(`node type "${key}" is already in the note schema`)
      nodeTypes[key] = { group, what }
    }
  }
  const edgeTypes = {
    ...schema.relationshipTypes.derived,
    ...schema.relationshipTypes.hand,
  }
  for (const [key, what] of Object.entries(EXTRA_EDGE_TYPES)) {
    if (edgeTypes[key]) throw new Error(`relationship type "${key}" is already in the note schema`)
    edgeTypes[key] = what
  }
  return { nodeTypes, edgeTypes, layers: LAYERS }
}
