/**
 * Values the planner scripts must agree on, defined once (guard rail 1): the organization and
 * board number, where the label policy lives, and the epic label.
 */
export const ORG = 'SprecherEast'
export const PROJECT = '1'
export const POLICY_URL = new URL('../.github/label-policy.json', import.meta.url)
export const EPIC_LABEL = 'epic'

/** Whether a list of label names marks an epic. */
export const isEpic = (labels) => labels.includes(EPIC_LABEL)
