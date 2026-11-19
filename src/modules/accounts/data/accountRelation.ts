/** A relationship to an account as the database adapter returns it: the id, or the row. */
export type AccountRelation = number | { id: number } | null | undefined

/** The account's id from a relationship, or null when there is none. */
export const toAccountId = (account: AccountRelation): number | null =>
  account === null || account === undefined
    ? null
    : typeof account === 'object'
      ? account.id
      : account
