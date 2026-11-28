/**
 * The shared components of the map (#1462): a node for each exported component of the UI kit and
 * rich text, its props, and which screens, modules and areas use it. Read from the components
 * facts (the compiler's types and imports), never from the generated pages. Pure.
 */
import { makeEdge, makeNode, nodeId } from './graph.mjs'

/** `{ nodes, edges, gaps }`; `users` maps a component name to the files that import it. */
export function buildComponents({ components, users, ownerOf, screenByFile }) {
  const nodes = []
  const edges = []
  for (const component of components) {
    const id = nodeId('shared-component', component.name)
    const owner = ownerOf(component.file)
    nodes.push(
      makeNode({
        id,
        type: 'shared-component',
        name: component.name,
        summary: component.description,
        path: component.file,
        module: owner?.top ?? '',
        fields: component.props.map((prop) => ({
          name: prop.name,
          type: prop.type,
          required: !prop.optional,
          detail: prop.doc,
          notes: prop.variant ? ['variant'] : [],
        })),
        facts: [
          ...(component.inherited > 0
            ? [{ label: 'Props from its element', value: String(component.inherited) }]
            : []),
          ...(component.parts.length > 0
            ? [{ label: 'Parts', value: component.parts.map((part) => part.name).join(', ') }]
            : []),
        ],
      }),
    )
    if (owner) edges.push(makeEdge({ from: owner.id, to: id, type: 'contains' }))
    for (const file of users.get(component.name) ?? []) {
      const screen = screenByFile.get(file)
      const user = ownerOf(file)
      if (screen) edges.push(makeEdge({ from: screen, to: id, type: 'renders' }))
      else if (user && user.top !== owner?.top)
        edges.push(makeEdge({ from: user.top, to: id, type: 'uses' }))
    }
  }
  return { nodes, edges, gaps: [] }
}
