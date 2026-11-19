import { text, textarea } from 'payload/shared'

/**
 * Payload's `required` lets a field of only spaces through, and the blocks read such a value as
 * empty (a key fact without a value or label is dropped, a heading is blank). `filledWith(check)`
 * runs Payload's own check first (required, maxLength), then refuses text that is blank once
 * trimmed. One definition for the key fact fields (shared by the key facts and fact tabs blocks)
 * and the tabs' heading and definition.
 */
type Check<A> = (value: string | null | undefined, args: A) => true | string

const filledWith =
  <A>(check: Check<A>) =>
  (message: string) =>
  (value: string | null | undefined, args: A): true | string => {
    const own = check(value, args)
    if (own !== true) return own
    return typeof value === 'string' && value.trim() === '' ? message : true
  }

export const filledText = filledWith(text as Check<Parameters<typeof text>[1]>)
export const filledTextarea = filledWith(textarea as Check<Parameters<typeof textarea>[1]>)
