/**
 * The block types of the editorial blocks, written once: the block configs name their slug from
 * them, and the code that reads a rich-text tree (the Markdown tags, the article width) matches on
 * them. A leaf module, so a config and the code that reads it can both import it without a cycle.
 */
export const FACT_TABS_BLOCK_TYPE = 'factTabs'
export const KEY_FACTS_BLOCK_TYPE = 'keyFacts'
export const OUTCOME_FORK_BLOCK_TYPE = 'outcomeFork'
