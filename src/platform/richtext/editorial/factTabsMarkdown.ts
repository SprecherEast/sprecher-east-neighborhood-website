import { importOrRefuse, writeProp } from './editorialTag'
import { toFactTabsProps, type StoredFactTabs } from './factTabs'
import { factTabsFromTag, factTabsToTag } from './factTabsTag'
import { FACT_TABS_LIMITS } from './editorialLimits'

/**
 * The fact tabs block as one Markdown tag (#664), for agents: `<FactTabs tabs={[…]} />`, written
 * and read with the same escaping as `<Chart>` (`editorialTag.ts`) and judged by the same rules as
 * the editor's fields (`factTabsTag.ts`). A tag that breaks them is refused with the reasons, so
 * `submitSuggestion` can hand them back to the agent.
 */

/**
 * The block as its Markdown tag, or false when it could not be read back: tabs outside the limits
 * or a tab with nothing in its panel (a chart that fails its rules is left out of the panel).
 */
export function factTabsToJsx(fields: StoredFactTabs): string | false {
  const { tabs } = toFactTabsProps(fields)
  const complete =
    tabs.length >= FACT_TABS_LIMITS.minTabs &&
    tabs.length <= FACT_TABS_LIMITS.maxTabs &&
    tabs.every(({ panel }) => panel.length >= FACT_TABS_LIMITS.minPanelBlocks)
  return complete ? `<FactTabs ${writeProp('tabs', factTabsToTag(tabs))} />` : false
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
