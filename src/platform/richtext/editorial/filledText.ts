import type { TextareaFieldValidation, TextFieldSingleValidation } from 'payload'
import { text, textarea } from 'payload/shared'

/**
 * Payload's `required` lets a field of only spaces through, and the blocks read such a value as
 * empty (a key fact without a value or label is dropped, a heading is blank). These run Payload's
 * own checks first (required, maxLength), then refuse text that is blank once trimmed. One
 * definition for the key fact fields (shared by the key facts and fact tabs blocks) and the tabs'
 * heading and definition.
 */
export const filledText =
  (message: string): TextFieldSingleValidation =>
  (value, args) => {
    const own = text(value, args)
    if (own !== true) return own
    return typeof value === 'string' && value.trim() === '' ? message : true
  }

export const filledTextarea =
  (message: string): TextareaFieldValidation =>
  (value, args) => {
    const own = textarea(value, args)
    if (own !== true) return own
    return typeof value === 'string' && value.trim() === '' ? message : true
  }
