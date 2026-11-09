export const ROADMAP_PATH = '/roadmap'

/** An issue's page on the site, by its GitHub number */
export const planIssuePath = (number: number) => `${ROADMAP_PATH}/${number}`

/** A GitHub issue number from an address segment: plain digits, no leading zero; else `undefined` */
export const parseIssueNumber = (value: string) =>
  /^[1-9]\d{0,8}$/.test(value) ? Number(value) : undefined
