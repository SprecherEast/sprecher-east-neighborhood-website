/**
 * The page's panels (#1463): controls, search results, outline, legend, changes and the detail
 * panel. Each builds elements from data and calls back into the app; none holds state of its own
 * beyond the elements. Browser code.
 */
import { fill, h, lineSwatch, shapeSwatch } from './dom.mjs'
import { editorUrl, githubUrl, issueSearchUrl, safeIssueUrl } from './links.mjs'
import { ancestors } from './model.mjs'

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const labelOf = (key) => key.replace(/-/g, ' ')
const SHORTCUTS = [
  ['/', 'Search'],
  ['F', 'Fit everything on the screen'],
  ['E', 'Expand every part'],
  ['C', 'Collapse back to the overview'],
  ['L', 'Switch between the free and the mind-map layout'],
  ['P', 'Trace the shortest path from the selected node to the next one you pick'],
  ['Enter', 'Expand or collapse the selected node'],
  ['U', 'Unpin the selected node'],
  ['T', 'Switch between light and dark'],
  ['S', 'Show or hide the controls'],
  ['Arrow keys', 'Move the map (focus the map first)'],
  ['+ and −', 'Zoom in and out'],
  ['?', 'Show this list'],
  ['Escape', 'Clear the selection, the path and the search'],
]

/** One labelled check box with an optional swatch: a switch the reader can flip. */
function toggleRow({ id, label, swatch, count, checked, onChange, extra }) {
  const input = h('input', { type: 'checkbox', id, checked, onchange: onChange })
  input.checked = checked
  return {
    input,
    row: h(
      'div',
      { class: 'row' },
      input,
      h(
        'label',
        { for: id },
        swatch,
        h('span', { class: 'name' }, label),
        count === undefined ? null : h('span', { class: 'count' }, String(count)),
      ),
      extra,
    ),
  }
}

/** The controls column: layout, layers, node types, modules and the view buttons. */
export function buildControls({ model, styles, layerStyles, moduleHueOf, dark, api }) {
  const graph = model.graph
  const refs = {
    layers: new Map(),
    types: new Map(),
    modules: new Map(),
    layout: new Map(),
    solo: new Map(),
  }
  const typeCounts = {}
  for (const node of graph.nodes) typeCounts[node.type] = (typeCounts[node.type] ?? 0) + 1
  const layerCounts = {}
  for (const edge of graph.edges) layerCounts[edge.layer] = (layerCounts[edge.layer] ?? 0) + 1

  refs.search = h('input', {
    type: 'search',
    id: 'search',
    autocomplete: 'off',
    spellcheck: 'false',
    placeholder: 'Name, path, route, field…',
    'aria-describedby': 'search-hint',
    oninput: (e) => api.search(e.target.value),
    onkeydown: (e) => e.key === 'Enter' && api.searchEnter(),
  })
  refs.results = h('ul', { class: 'results', id: 'results', 'aria-label': 'Search results' })
  refs.since = h('select', { id: 'since', onchange: (e) => api.setSince(e.target.value) })
  refs.sinceNote = h('p', { class: 'hint', id: 'since-note' })
  refs.changes = h('ul', {
    class: 'results',
    id: 'changes',
    'aria-label': 'Nodes changed since the chosen build',
  })

  const layoutButtons = [
    ['free', 'Free'],
    ['mind', 'Mind map'],
  ].map(([mode, text]) => {
    const button = h(
      'button',
      { type: 'button', 'aria-pressed': 'false', onclick: () => api.setLayout(mode) },
      text,
    )
    refs.layout.set(mode, button)
    return button
  })

  const layerRows = graph.layers.map((layer) => {
    const { input, row } = toggleRow({
      id: `layer-${layer.key}`,
      label: layer.label,
      swatch: lineSwatch(layerStyles[layer.key].hue, layerStyles[layer.key].dash, dark),
      count: layerCounts[layer.key] ?? 0,
      checked: true,
      onChange: () => api.toggleLayer(layer.key),
    })
    row.title = layer.what
    refs.layers.set(layer.key, input)
    return row
  })
  const typeRows = Object.keys(graph.nodeTypes)
    .sort()
    .map((type) => {
      const { input, row } = toggleRow({
        id: `type-${type}`,
        label: labelOf(type),
        swatch: shapeSwatch(styles[type].shape, styles[type].hue, dark),
        count: typeCounts[type] ?? 0,
        checked: true,
        onChange: () => api.toggleType(type),
      })
      row.title = graph.nodeTypes[type].what
      refs.types.set(type, input)
      return row
    })
  const moduleRows = model.modules.map((id) => {
    const solo = h(
      'button',
      {
        type: 'button',
        class: 'only',
        'aria-pressed': 'false',
        'aria-label': `Show only ${model.nodes.get(id).name}`,
        onclick: () => api.soloModule(id),
      },
      'Only',
    )
    refs.solo.set(id, solo)
    const { input, row } = toggleRow({
      id: `module-${model.nodes.get(id).name}`,
      label: model.nodes.get(id).name,
      swatch: shapeSwatch('circle', moduleHueOf(id), dark),
      checked: true,
      onChange: () => api.toggleModule(id),
      extra: solo,
    })
    refs.modules.set(id, input)
    return row
  })

  const group = (title, ...kids) =>
    h(
      'section',
      { class: 'group', 'aria-labelledby': `h-${title}` },
      h('h2', { id: `h-${title}` }, title),
      ...kids,
    )
  const button = (text, onclick, extra = {}) =>
    h('button', { type: 'button', onclick, ...extra }, text)
  refs.trace = button('Trace path', () => api.tracePath(), { 'aria-pressed': 'false' })
  refs.el = h(
    'div',
    { class: 'controls' },
    h(
      'div',
      { class: 'search' },
      h('label', { for: 'search' }, 'Search the map'),
      refs.search,
      h(
        'p',
        { class: 'hint', id: 'search-hint' },
        'Press / to search. Enter opens the first result.',
      ),
      refs.results,
    ),
    group(
      'Layout',
      h('div', { class: 'segmented', role: 'group', 'aria-label': 'Layout' }, layoutButtons),
    ),
    group(
      'View',
      h(
        'div',
        { class: 'buttons' },
        button('Fit', () => api.fit()),
        button('Expand all', () => api.expandAll()),
        button('Collapse', () => api.collapseAll()),
        refs.trace,
        button('Help', () => api.openHelp()),
      ),
    ),
    group('Connection layers', h('div', { class: 'rows' }, layerRows)),
    group(
      'What changed',
      h('label', { for: 'since' }, 'Changed since'),
      refs.since,
      refs.sinceNote,
      refs.changes,
    ),
    group(
      'Modules',
      h('div', { class: 'rows' }, moduleRows),
      h('button', { type: 'button', onclick: () => api.showAllModules() }, 'Show all modules'),
    ),
    group('Node types', h('div', { class: 'rows' }, typeRows)),
    h(
      'details',
      { class: 'outline' },
      h('summary', {}, 'Outline of what is shown'),
      (refs.outline = h('div', { id: 'outline' })),
    ),
  )
  return refs
}

/** Makes the controls show the state: which layers, types and modules are on, which layout. */
export function syncControls(refs, state, layout) {
  for (const [key, input] of refs.layers) input.checked = !state.hiddenLayers.has(key)
  for (const [key, input] of refs.types) input.checked = !state.hiddenTypes.has(key)
  for (const [id, input] of refs.modules)
    input.checked = !state.hiddenModules.has(id) && (state.solo === null || state.solo === id)
  for (const [id, button] of refs.solo)
    button.setAttribute('aria-pressed', String(state.solo === id))
  for (const [mode, button] of refs.layout)
    button.setAttribute('aria-pressed', String(mode === layout))
}

/** A list of nodes as buttons; `why` says what matched. */
export function nodeList(el, model, items, onPick, empty) {
  fill(
    el,
    items.length === 0
      ? h('li', { class: 'hint' }, empty)
      : items.map((item) => {
          const node = model.nodes.get(item.id)
          return h(
            'li',
            {},
            h(
              'button',
              { type: 'button', class: 'link', onclick: () => onPick(item.id) },
              h('span', { class: 'name' }, node.name),
              h('span', { class: 'kind' }, labelOf(node.type)),
              item.why ? h('span', { class: 'why' }, item.why) : null,
            ),
          )
        }),
  )
}

/** The shown nodes, nested by what contains what: the keyboard and screen reader view of the map. */
export function renderOutline(el, model, view, state, selected, api) {
  const list = (ids) =>
    h(
      'ul',
      {},
      ids.map((id) => item(id)),
    )
  const shownBelow = (id) =>
    model.children.get(id).flatMap((c) => (view.shown.has(c) ? [c] : shownBelow(c)))
  const item = (id) => {
    const node = model.nodes.get(id)
    const kids = model.children.get(id)
    const open = state.expanded.has(id)
    const below = shownBelow(id)
    return h(
      'li',
      {},
      h(
        'div',
        { class: 'leaf' },
        kids.length > 0
          ? h(
              'button',
              {
                type: 'button',
                class: 'twisty',
                'aria-expanded': String(open),
                'aria-label': `${open ? 'Collapse' : 'Expand'} ${node.name}`,
                onclick: () => api.toggleNode(id),
              },
              open ? '−' : '+',
            )
          : h('span', { class: 'twisty' }),
        h(
          'button',
          {
            type: 'button',
            class: 'link',
            'aria-current': id === selected ? 'true' : null,
            onclick: () => api.select(id),
          },
          node.name,
          h('span', { class: 'kind' }, labelOf(node.type)),
        ),
      ),
      open && below.length > 0 ? list(below) : null,
    )
  }
  fill(
    el,
    model.root ? list(view.shown.has(model.root) ? [model.root] : shownBelow(model.root)) : null,
  )
}

/** The legend of node shapes; the line styles sit beside their layer switches. */
export function renderLegend(el, { model, styles, dark }) {
  const present = [...new Set(model.graph.nodes.map((n) => n.type))].sort()
  fill(
    el,
    h('h2', {}, 'Legend'),
    h(
      'ul',
      {},
      present.map((t) =>
        h('li', {}, shapeSwatch(styles[t].shape, styles[t].hue, dark, 16), labelOf(t)),
      ),
    ),
    h('p', { class: 'hint' }, 'Line styles are shown beside each layer switch in the controls.'),
  )
}

export const helpContent = () =>
  h(
    'dl',
    {},
    SHORTCUTS.flatMap(([key, what]) => [h('dt', {}, h('kbd', {}, key)), h('dd', {}, what)]),
  )
export const HOW_TO = [
  'Drag the map to move it; scroll, pinch or use + and − to zoom.',
  'Click a node to see what it is and what it connects to. Double-click, or press Enter, to open or close what it holds.',
  'Switch connection layers, modules and node types on and off in the controls.',
  'Search finds a node by its name, path, route or field. Trace path shows the shortest route between two nodes.',
]

function section(title, ...kids) {
  return h('section', { class: 'detail-section' }, h('h3', {}, title), ...kids)
}

/** The side panel (a bottom sheet on a phone) for one node. */
export function renderDetail(el, { node, model, view, history, snapshot, folder, api, since }) {
  const repo = model.graph.repository
  const here = history?.nodes?.[node.id]
  const gh = githubUrl(repo, node.path)
  const editor = editorUrl(folder, node.path)
  const crumbs = ancestors(model, node.id).reverse()
  const groups = new Map()
  for (const link of model.links.get(node.id)) {
    const edge = model.graph.edges[link.index]
    const key = edge.layer
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ link, edge })
  }
  const layerLabel = Object.fromEntries(model.graph.layers.map((l) => [l.key, l.label]))
  const tasks = snapshot?.nodes?.[node.id] ?? []
  fill(
    el,
    h(
      'header',
      {},
      h(
        'div',
        {},
        h('p', { class: 'eyebrow' }, labelOf(node.type), since?.has(node.id) ? ' · changed' : ''),
        h('h2', { id: 'detail-title', tabindex: '-1' }, node.name),
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'close',
          'aria-label': 'Close the details',
          onclick: () => api.clearSelection(),
        },
        '×',
      ),
    ),
    crumbs.length > 0
      ? h(
          'nav',
          { class: 'crumbs', 'aria-label': 'Where it sits' },
          h(
            'ol',
            {},
            crumbs.map((id) =>
              h(
                'li',
                {},
                h(
                  'button',
                  { type: 'button', class: 'link', onclick: () => api.select(id) },
                  model.nodes.get(id).name,
                ),
              ),
            ),
            h('li', { 'aria-current': 'page' }, node.name),
          ),
        )
      : null,
    h('p', { class: 'summary' }, node.summary),
    h(
      'div',
      { class: 'actions' },
      gh
        ? h(
            'a',
            { href: gh, target: '_blank', rel: 'noopener noreferrer', class: 'button' },
            'Open on GitHub',
          )
        : null,
      h(
        'button',
        { type: 'button', onclick: () => api.openEditor(node.id) },
        editor ? 'Open in editor' : 'Open in editor…',
      ),
      h(
        'button',
        { type: 'button', onclick: () => api.traceFrom(node.id) },
        'Trace path from here',
      ),
      model.children.get(node.id).length > 0
        ? h(
            'button',
            {
              type: 'button',
              onclick: () => api.toggleNode(node.id),
              'aria-expanded': String(view.shown.has(model.children.get(node.id)[0])),
            },
            view.shown.has(model.children.get(node.id)[0]) ? 'Collapse' : 'Expand',
          )
        : null,
      api.isPinned(node.id)
        ? h('button', { type: 'button', onclick: () => api.unpin(node.id) }, 'Unpin')
        : null,
    ),
    section(
      'Facts',
      h(
        'dl',
        {},
        node.path ? [h('dt', {}, 'Path'), h('dd', {}, h('code', {}, node.path))] : null,
        node.module
          ? [h('dt', {}, 'Module'), h('dd', {}, model.nodes.get(node.module)?.name ?? node.module)]
          : null,
        node.aliases.length > 0
          ? [h('dt', {}, 'Also called'), h('dd', {}, node.aliases.join(', '))]
          : null,
        h('dt', {}, 'Last change'),
        h(
          'dd',
          {},
          here
            ? `${here.date.slice(0, 10)}: ${here.subject}`
            : history?.available
              ? 'No recent commit changed it'
              : 'No history in this build',
        ),
        node.facts.map((f) => [
          h('dt', {}, f.label ?? f.name ?? 'Fact'),
          h('dd', {}, f.value ?? String(f)),
        ]),
      ),
    ),
    node.watchOuts.length > 0
      ? section(
          'Watch out',
          h(
            'ul',
            {},
            node.watchOuts.map((w) =>
              h('li', {}, typeof w === 'string' ? w : (w.text ?? JSON.stringify(w))),
            ),
          ),
        )
      : null,
    groups.size > 0
      ? section(
          'Connections',
          [...groups].map(([key, list]) =>
            connectionGroup(key, layerLabel[key] ?? key, list, model, node, api),
          ),
        )
      : null,
    node.fields.length > 0
      ? section(`Fields (${node.fields.length})`, fieldTable(node.fields))
      : null,
    section(
      'Open tasks',
      snapshot?.available
        ? h(
            'p',
            { class: 'hint' },
            `As of ${snapshot.date}: ${plural(tasks.length, 'open issue')}.`,
          )
        : h(
            'p',
            { class: 'hint' },
            `No snapshot of the open issues in this build${snapshot?.reason ? ` (${snapshot.reason})` : ''}.`,
          ),
      h(
        'ul',
        {},
        tasks.map((t) =>
          h(
            'li',
            {},
            safeIssueUrl(t.url)
              ? h(
                  'a',
                  { href: safeIssueUrl(t.url), target: '_blank', rel: 'noopener noreferrer' },
                  `#${t.number} ${t.title}`,
                )
              : `#${t.number} ${t.title}`,
          ),
        ),
      ),
      h(
        'p',
        {},
        h(
          'a',
          { href: issueSearchUrl(repo, node.path), target: '_blank', rel: 'noopener noreferrer' },
          'Search the open issues now',
        ),
      ),
    ),
  )
}

function connectionGroup(key, label, list, model, node, api) {
  const shown = list.slice(0, 12)
  const row = ({ link, edge }) =>
    h(
      'li',
      {},
      h('span', { class: 'kind' }, link.outgoing ? `${edge.type} →` : `← ${edge.type}`),
      h(
        'button',
        { type: 'button', class: 'link', onclick: () => api.select(link.other) },
        model.nodes.get(link.other).name,
      ),
      edge.count > 1 ? h('span', { class: 'count' }, `×${edge.count}`) : null,
    )
  return h(
    'div',
    { class: 'conns' },
    h('h4', {}, `${label} (${list.length})`),
    h('ul', {}, shown.map(row)),
    list.length > 12
      ? h(
          'details',
          {},
          h('summary', {}, `Show ${list.length - 12} more`),
          h('ul', {}, list.slice(12).map(row)),
        )
      : null,
  )
}

function fieldTable(fields) {
  return h(
    'table',
    {},
    h(
      'thead',
      {},
      h(
        'tr',
        {},
        ['Name', 'Type', 'Notes'].map((t) => h('th', { scope: 'col' }, t)),
      ),
    ),
    h(
      'tbody',
      {},
      fields.map((f) =>
        h(
          'tr',
          {},
          h('th', { scope: 'row' }, f.name),
          h('td', {}, f.type, f.required ? h('span', { class: 'badge' }, 'required') : null),
          h('td', {}, [f.detail, ...(f.notes ?? [])].filter(Boolean).join('; ')),
        ),
      ),
    ),
  )
}
