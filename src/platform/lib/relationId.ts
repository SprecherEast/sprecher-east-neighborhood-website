/** A relationship field as Payload returns it: the id, or the document when it was populated. */
export type Relation = number | { id: number }

/** The id of a relationship value, whether Payload gave the document or only its id; null when none. */
export const relationId = (value: Relation | null | undefined): number | null =>
  typeof value === 'object' && value !== null ? value.id : (value ?? null)
