import { importOrRefuse, writeProp } from './editorialTag'
import { toFactTabsProps, type StoredFactTabs } from './factTabs'
import { factTabsFromTag, factTabsToTag } from './factTabsTag'

/**
 * The fact tabs block as one Markdown tag (#664), for agents: `<FactTabs tabs={[…]} />`, written
 * and read with the same escaping as `<Chart>` (`editorialTag.ts`) and judged by the same rules as
 * the editor's fields (`factTabsTag.ts`). A tag that breaks them is refused with the reasons, so
 * `submitSuggestion` can hand them back to the agent.
 */

/**
 * The block as its Markdown tag, or false when the tag would not read back: the tabs as written are
 * judged by the import's own rules (`factTabsFromTag`: the limits, the chart rules, one "Next up"),
 * so what is exported can always be imported. A drawn chart that fails its rules is left out of its
 * panel before that, and a panel left empty fails the check. A draft may hold any of this, since
 * Payload skips validation for drafts.
 */
export function factTabsToJsx(fields: StoredFactTabs): string | false {
  const written = factTabsToTag(toFactTabsProps(fields).tabs)
  try {
    factTabsFromTag(written)
  } catch {
    return false
  }
  return `<FactTabs ${writeProp('tabs', written)} />`
}

/** `jsx.import`: the block's fields for the tag, or false (and a collected refusal) when it is invalid */
export function importFactTabsTag(props: Record<string, unknown>): StoredFactTabs | false {
  return importOrRefuse(() => {
    const unknown = Object.keys(props).filter((name) => name !== 'tabs')
    if (unknown.length > 0) {
      throw new Error(`Invalid <FactTabs>: ${unknown.join(', ')} is not a property (use tabs)`)
    }
    return factTabsFromTag(props.tabs)
  })
}
