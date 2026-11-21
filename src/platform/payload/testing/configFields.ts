/**
 * Walking the fields of a Payload config object, for the tests that read it with no database
 * (#140, #299, #1395).
 */

export type FieldNode = {
  name?: string
  type?: string
  hidden?: boolean
  relationTo?: string | string[]
  access?: { read?: unknown; create?: unknown; update?: unknown }
  fields?: FieldNode[]
  tabs?: FieldNode[]
  blocks?: FieldNode[]
}

/** The fields, tabs and blocks directly inside one node. */
export const fieldChildren = (node: FieldNode): FieldNode[] => [
  ...(node.fields ?? []),
  ...(node.tabs ?? []),
  ...(node.blocks ?? []),
]

/** Every field below `node`, however deeply nested. */
export const fieldDescendants = (node: FieldNode): FieldNode[] =>
  fieldChildren(node).flatMap((child) => [child, ...fieldDescendants(child)])
