import { importOrRefuse, readText, writeProp } from './editorialTag'
import { SECTION_TABS_LIMITS } from './editorialLimits'
import type { StoredSectionTabs } from './sectionTabs'

/**
 * The section tabs block as Markdown (#1333), for agents: a `<SectionTabs>` tag that holds one
 * `<Tab label="…">` per tab, each with its content written as ordinary Markdown (headings, lists,
 * and the other editorial tags). The label is written with the same escaping as every editorial
 * tag (`editorialTag.ts`), and a tag that breaks the block's rules is refused with the reasons, so
 * `submitSuggestion` can hand them back to the agent.
 */

type LexicalState = Record<string, unknown>

/** Payload's converters, handed to the block's `jsx` functions */
type ToMarkdown = (args: { editorState: LexicalState }) => string
type ToLexical = (args: { markdown: string }) => LexicalState

const TAB = /<Tab\s+label="((?:[^"\\]|\\.)*)"\s*>([\s\S]*?)<\/Tab>/g

const refuse = (reason: string): never => {
  throw new Error(`Invalid <SectionTabs>: ${reason}`)
}

/** The block as Markdown: the tag with its tabs, or false when it has no tab to write */
export function sectionTabsToJsx(
  fields: StoredSectionTabs,
  lexicalToMarkdown: ToMarkdown,
): string | false {
  const tabs = (fields.tabs ?? []).flatMap((tab) => {
    const label = tab.label?.trim()
    if (!label || !tab.panel) return []
    const body = lexicalToMarkdown({ editorState: tab.panel as unknown as LexicalState }).trim()
    return [`<Tab ${writeProp('label', label)}>\n\n${body}\n\n</Tab>`]
  })
  // The whole tag, so it is written `<SectionTabs>` like the other editorial tags, not with the slug
  return tabs.length > 0 ? `<SectionTabs>\n${tabs.join('\n')}\n</SectionTabs>` : false
}

/**
 * `jsx.import`: the block's fields for the tag, or false (and a collected refusal) when it is
 * invalid. Each tab's content is read by Payload's own Markdown converter, so it becomes the same
 * rich text the editor saves.
 */
export function importSectionTabsTag(args: {
  children: string
  props: Record<string, unknown>
  markdownToLexical: ToLexical
}): StoredSectionTabs | false {
  return importOrRefuse(() => {
    const unknown = Object.keys(args.props)
    if (unknown.length > 0) {
      refuse(`${unknown.join(', ')} is not a property (a tab is written as <Tab label="…">)`)
    }
    const tabs = [...args.children.matchAll(TAB)].map(([, label = '', body = '']) => ({
      label: readText(label).trim(),
      body: body.trim(),
    }))
    const outside = args.children.replace(TAB, '').trim()
    if (outside) refuse('write each tab as <Tab label="…">…</Tab>, with nothing between them')
    const { minTabs, maxTabs, label: labelMax } = SECTION_TABS_LIMITS
    if (tabs.length < minTabs || tabs.length > maxTabs) {
      refuse(`add ${minTabs} to ${maxTabs} tabs: there are ${tabs.length}`)
    }
    for (const [index, tab] of tabs.entries()) {
      const where = `tab ${index + 1}`
      if (!tab.label) refuse(`${where} has no label`)
      if (tab.label.length > labelMax) {
        refuse(`${where}'s label is longer than ${labelMax} characters`)
      }
      if (!tab.body) refuse(`${where} ("${tab.label}") has no content`)
      if (/<SectionTabs[\s>]/i.test(tab.body)) refuse(`${where} holds tabs: tabs cannot nest`)
    }
    return {
      tabs: tabs.map((tab) => ({
        label: tab.label,
        panel: args.markdownToLexical({ markdown: tab.body }),
      })),
    } as unknown as StoredSectionTabs
  })
}
