/**
 * Values the planner scripts must agree on, defined once (guard rail 1): the organization and
 * board number and where the label policy lives. (The epic label has one definition, `isEpic` in
 * `.github/scripts/issue-policy.mjs`.)
 */
export const ORG = 'SprecherEast'
export const PROJECT = '1'
export const POLICY_URL = new URL('../.github/label-policy.json', import.meta.url)
