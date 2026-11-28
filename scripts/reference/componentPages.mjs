/**
 * The pages of the shared-components reference (#718): the text written for each group of
 * components and for the index, from what `components.mjs` read.
 */
import { cell, code, generatedNotice, table } from '../content-types/render.mjs'
import { ROUTES_ROOT, routeUrl } from './routes.mjs'

/** Splits user files into the modules, routes and platform areas they belong to. */
export function usersLabel(files) {
  const out = { modules: new Set(), routes: new Set(), platform: new Set(), other: new Set() }
  for (const file of files) {
    const parts = file.split('/')
    if (file.startsWith(`${ROUTES_ROOT}/`)) {
      out.routes.add(routeUrl(file.slice(ROUTES_ROOT.length + 1)))
    } else if (parts[1] === 'modules') out.modules.add(parts[2])
    else if (parts[1] === 'platform') out.platform.add(`platform/${parts[2]}`)
    else out.other.add(parts.slice(0, 3).join('/'))
  }
  return Object.fromEntries(Object.entries(out).map(([key, set]) => [key, [...set].sort()]))
}

const list = (items) => items.map(code).join(', ')

function renderUsers(files) {
  if (files.length === 0) return '**Used by** (direct imports): nothing yet.'
  const label = usersLabel(files)
  const lines = [
    ['Modules', label.modules],
    ['Routes', label.routes],
    ['Platform', label.platform],
    ['Elsewhere', label.other],
  ]
    .filter(([, items]) => items.length > 0)
    .map(([title, items]) => `${title}: ${list(items)}`)
  return ['**Used by** (direct imports):', '', ...lines.map((line) => `- ${line}`)].join('\n')
}

function renderProps(entry) {
  const plain = entry.props.filter((p) => !p.variant)
  const variants = entry.props.filter((p) => p.variant)
  const out = []
  if (variants.length > 0) {
    out.push('**Variants:**', '')
    // Outside a table a pipe needs no escape
    for (const v of variants) out.push(`- ${code(v.name)}: \`${v.type}\``)
    out.push('')
  }
  if (plain.length > 0) {
    out.push(
      table(
        ['Prop', 'Type', 'Required', 'Description'],
        plain.map((p) => [code(p.name), code(p.type), p.optional ? 'no' : 'yes', cell(p.doc)]),
      ),
      '',
    )
  } else if (variants.length === 0) {
    out.push('No props.', '')
  }
  if (entry.inherited > 0) {
    out.push(
      `${entry.inherited} more props from package types (HTML attributes and the like) are not listed.`,
      '',
    )
  }
  return out
}

/** One group's page: `group` is `{ title, intro }`; `components` are its described components. */
export function renderComponentPage(group, components, users) {
  const out = [
    `# Components: ${group.title}`,
    '',
    generatedNotice('the TypeScript types and imports under `src/`'),
    '',
    group.intro,
    '',
  ]
  for (const component of components) {
    out.push(`## ${code(component.name)}`, '')
    if (component.description) out.push(component.description, '')
    out.push(`Source: ${code(component.file)}`, '')
    out.push(...renderProps(component))
    for (const part of component.parts) {
      out.push(`### ${code(part.name)}`, '')
      if (part.description) out.push(part.description, '')
      out.push(...renderProps(part))
    }
    out.push(renderUsers(users.get(component.name) ?? []), '')
  }
  return out.join('\n')
}

/** Puts the components in their groups; fails on one in no group, or a name no component has. */
export function groupComponents(groups, components) {
  const byName = new Map(components.map((c) => [c.name, c]))
  const listed = new Set(groups.flatMap((g) => g.components))
  const missing = components.filter((c) => !listed.has(c.name)).map((c) => c.name)
  const stale = [...listed].filter((name) => !byName.has(name))
  if (missing.length > 0 || stale.length > 0) {
    throw new Error(
      [
        'scripts/reference/componentGroups.mjs is out of step with the components:',
        ...missing.map((name) => `  ${name} is exported but in no group`),
        ...stale.map((name) => `  ${name} is in a group but no longer exported`),
      ].join('\n'),
    )
  }
  return groups.map((g) => ({ ...g, components: g.components.map((name) => byName.get(name)) }))
}

/** The README of docs/reference/components/: one line per page, and how much of the kit the showcase covers. */
export function renderComponentIndex(groups, coverage) {
  const count = groups.reduce((total, g) => total + g.components.length, 0)
  return [
    '# Shared components',
    '',
    generatedNotice('the TypeScript types and imports under `src/`'),
    '',
    `${count} components from \`src/platform/ui/\` and \`src/platform/richtext/\`, with their props and where they are used. The rules every component follows, and the choices behind them, are in [component-set.md](../../ui/component-set.md). \`/dev/gallery\` shows them.`,
    '',
    ...(coverage
      ? [
          `${coverage.withExamples} of ${coverage.total} components have showcase examples (an \`*.examples.tsx\` file beside the component, [showcase-examples.md](../../ui/showcase-examples.md)). The index the showcase is built from, with each component's props, variants, usage and examples, is [showcase-index.json](../showcase-index.json); its \`coverage.missing\` lists the rest.`,
          '',
        ]
      : []),
    table(
      ['Page', 'Components'],
      groups.map((g) => [
        `[${g.title}](${g.slug}.md)`,
        g.components.map((c) => code(c.name)).join(', '),
      ]),
    ),
    '',
  ].join('\n')
}
