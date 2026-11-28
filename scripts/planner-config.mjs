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

/** The columns from first to last; "backwards" means to an earlier one. */
export const STATUS_ORDER = Object.freeze(Object.values(STATUS))

/**
 * Whose comments and pull requests count as work on an issue (GitHub's author association): the
 * people who can write to this repository. The repository is public, so anyone else may comment or
 * open a pull request, and neither may start work or move a card.
 */
export const TRUSTED_ASSOCIATIONS = Object.freeze(new Set(['OWNER', 'MEMBER', 'COLLABORATOR']))

/** What the report shows for a card that has no Status value yet. */
export const NO_STATUS = 'No status'
