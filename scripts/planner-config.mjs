/**
 * Values the planner scripts must agree on, defined once (guard rail 1): the organization and
 * board number, where the label policy lives, the board's status names and the one way a card's
 * Status is read. (The epic label has one definition, `isEpic` in `.github/scripts/issue-policy.mjs`.)
 */
export const ORG = 'SprecherEast'
export const PROJECT = '1'
export const POLICY_URL = new URL('../.github/label-policy.json', import.meta.url)

/** The board's Status option names, as the board spells them. */
export const STATUS = Object.freeze({
  backlog: 'Backlog',
  ready: 'Ready',
  inProgress: 'In progress',
  inReview: 'In review',
  done: 'Done',
})

/** The name of the board's Status field, and the one query fragment that reads a card's value of it. */
export const STATUS_FIELD = 'Status'
export const CARD_STATUS_FRAGMENT = `status:fieldValueByName(name:"${STATUS_FIELD}"){... on ProjectV2ItemFieldSingleSelectValue{name}}`
